import MiniSearch from 'minisearch';
import type { VerifiedPatternService } from '../application/verified-patterns';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';

const DEFAULT_LIMIT = 8;
const MAX_EXCERPT = 800;
const MAX_ALTERNATES = 3;
const CJK_RUN = /[\u3400-\u9fff\uf900-\ufaff]+/gu;
const CJK_TERM = /^[\u3400-\u9fff\uf900-\ufaff]+$/u;
const LATIN_OR_NUMBER = /[a-z0-9]+/gi;
const STOP_WORDS = new Set([
  '我', '你', '他', '她', '它', '的', '了', '过', '吗', '呢', '啊', '吧', '把', '被', '跟', '和', '与', '以及',
  '是', '不', '有', '没', '也', '都', '还', '在', '是否', '是不是', '有没有', '能不能', '可以', '会不会',
  '以前', '之前', '最近', '一直', '总是', '经常', '反复', '曾经', '现在', '当时', '当初', '什么', '怎么', '如何',
]);

export type AgentMemorySearchHit = {
  id: string;
  kind: 'journal' | 'review' | 'pattern';
  date: string | null;
  excerpt: string;
};

type MemoryRecord = {
  id: string;
  kind: AgentMemorySearchHit['kind'];
  date: string | null;
  text: string;
  searchable: string;
};

type SearchInput = { query: string; limit?: number; alternates?: string[] };

type RankedHit = {
  record: MemoryRecord;
  score: number;
  terms: string[];
};

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim();
}

function normalizeAlternates(alternates: string[] | undefined): string[] {
  return [...new Set((alternates ?? []).map(normalize).filter(Boolean))].slice(0, MAX_ALTERNATES);
}

function addCjkBigrams(value: string, tokens: string[]): void {
  for (const match of value.matchAll(CJK_RUN)) {
    const chars = Array.from(match[0]);
    for (let index = 0; index < chars.length - 1; index += 1) tokens.push(chars.slice(index, index + 2).join(''));
  }
}

function tokenizeForSearch(value: string): string[] {
  const normalized = normalize(value);
  const tokens: string[] = [];
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: 'word' }) => { segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }> } }).Segmenter;
  if (Segmenter) {
    const segmenter = new Segmenter('zh-CN', { granularity: 'word' });
    for (const part of segmenter.segment(normalized)) {
      if (part.isWordLike === false) continue;
      const token = part.segment.trim();
      if (token) tokens.push(token);
    }
  } else {
    tokens.push(...(normalized.match(/[a-z0-9]+|[\u3400-\u9fff\uf900-\ufaff]+/gi) ?? []));
  }
  for (const match of normalized.matchAll(LATIN_OR_NUMBER)) tokens.push(match[0]);
  addCjkBigrams(normalized, tokens);

  return [...new Set(tokens.map((token) => token.trim()).filter((token) => {
    if (!token || STOP_WORDS.has(token)) return false;
    if (CJK_TERM.test(token) && Array.from(token).length < 2) return false;
    return true;
  }))];
}

function compact(value: string): string {
  return normalize(value).replace(/[\p{P}\p{S}\s]+/gu, '');
}

function phraseBoost(query: string, searchable: string): number {
  const phrase = compact(query);
  return phrase.length >= 2 && compact(searchable).includes(phrase) ? 0.5 : 0;
}

function excerptAround(text: string, terms: string[]): string {
  const lowerText = text.toLocaleLowerCase('zh-CN');
  const position = terms
    .map((term) => lowerText.indexOf(term.toLocaleLowerCase('zh-CN')))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;
  const start = Math.max(0, position - 180);
  const end = Math.min(text.length, start + MAX_EXCERPT);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

function buildIndex(records: MemoryRecord[]): MiniSearch {
  const index = new MiniSearch({
    fields: ['searchable'],
    storeFields: ['kind', 'date', 'text'],
    tokenize: tokenizeForSearch,
  });
  index.addAll(records);
  return index;
}

/**
 * Read-only local lexical recall over the existing authoritative data.
 * The MiniSearch index is rebuilt for every call and is never persisted.
 */
export class AgentMemorySearchService {
  constructor(
    private readonly journals: Pick<MarkdownJournalRepository, 'list'>,
    private readonly reviews: Pick<MarkdownReviewRepository, 'list'>,
    private readonly verifiedPatterns: Pick<VerifiedPatternService, 'list'>,
  ) {}

  async search(input: SearchInput): Promise<{ hits: AgentMemorySearchHit[] }> {
    const query = normalize(input.query);
    const queries = [query, ...normalizeAlternates(input.alternates)];
    const searchableQueries = [...new Set(queries)].filter((value) => tokenizeForSearch(value).length > 0);
    if (!searchableQueries.length) return { hits: [] };

    const [journals, reviews, patternSnapshot] = await Promise.all([
      this.journals.list(),
      this.reviews.list(),
      this.verifiedPatterns.list(),
    ]);
    const records: MemoryRecord[] = [
      ...journals.map((item) => ({
        id: item.id,
        kind: 'journal' as const,
        date: item.date,
        text: item.body,
        searchable: normalize([item.body, item.date, ...item.projectIds].join('\n')),
      })),
      ...reviews.map((item) => ({
        id: item.id,
        kind: 'review' as const,
        date: item.periodEnd,
        text: item.body,
        searchable: normalize([item.body, item.type, item.periodStart, item.periodEnd, item.projectId ?? ''].join('\n')),
      })),
      ...patternSnapshot.patterns.map((item) => ({
        id: item.id,
        kind: 'pattern' as const,
        date: item.createdAt.slice(0, 10),
        text: `${item.statement}\n${item.evidenceSummary}`,
        searchable: normalize([item.statement, item.evidenceSummary, ...item.sourceReviewIds].join('\n')),
      })),
    ];
    const recordsById = new Map(records.map((record) => [record.id, record]));
    const index = buildIndex(records);
    const rankedById = new Map<string, RankedHit>();

    for (const searchQuery of searchableQueries) {
      for (const result of index.search(searchQuery, { combineWith: 'OR' })) {
        const record = recordsById.get(String(result.id));
        if (!record) continue;
        const ranked: RankedHit = { record, score: result.score + phraseBoost(searchQuery, record.searchable), terms: result.terms };
        const previous = rankedById.get(record.id);
        if (!previous || ranked.score > previous.score) rankedById.set(record.id, ranked);
      }
    }

    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), DEFAULT_LIMIT);
    return {
      hits: [...rankedById.values()]
        .sort((left, right) => right.score - left.score || (right.record.date ?? '').localeCompare(left.record.date ?? '') || left.record.id.localeCompare(right.record.id))
        .slice(0, limit)
        .map(({ record, terms }) => ({ id: record.id, kind: record.kind, date: record.date, excerpt: excerptAround(record.text, terms) })),
    };
  }
}
