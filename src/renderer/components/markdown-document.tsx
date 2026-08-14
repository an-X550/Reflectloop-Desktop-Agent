import type { ReactNode } from 'react';

function stripFrontmatter(source: string) {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/** 行内渲染：**加粗**、*斜体*、`行内代码`。纯文本分片直接输出，不解析 HTML。 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0;
  let index = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith('**')) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('*')) nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    else nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    last = match.index + token.length;
    index += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function table(lines: string[], key: number): ReactNode {
  const rows = lines.map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  return <div className="markdown-table-wrap" key={key}><table><thead><tr>{rows[0].map((cell, index) => <th key={index}>{renderInline(cell, `th${index}`)}</th>)}</tr></thead><tbody>{rows.slice(2).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInline(cell, `td${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody></table></div>;
}

const UNORDERED = /^[-*]\s+/;
const ORDERED = /^\d+[.、)]\s+/;
const BLOCK_START = /^(#{1,6})\s+|^> |^[-*]\s+|^\d+[.、)]\s+|^\|.*\|$/;

export function MarkdownDocument({ children }: { children: string }) {
  const lines = stripFrontmatter(children).split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (/^\|.*\|$/.test(line) && /^\|[\s:|-]+\|$/.test(lines[index + 1] ?? '')) {
      const block = [line, lines[index + 1]];
      index += 2;
      while (/^\|.*\|$/.test(lines[index] ?? '')) block.push(lines[index++]);
      nodes.push(table(block, index));
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6);
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      nodes.push(<Tag key={index}>{renderInline(heading[2], `h${index}`)}</Tag>); index += 1; continue;
    }
    if (line.startsWith('> ')) { nodes.push(<blockquote key={index}>{renderInline(line.slice(2), `q${index}`)}</blockquote>); index += 1; continue; }
    if (UNORDERED.test(line)) {
      const items: string[] = [];
      while (UNORDERED.test(lines[index] ?? '')) items.push(lines[index++].replace(UNORDERED, ''));
      nodes.push(<ul key={index}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `li${index}-${itemIndex}`)}</li>)}</ul>); continue;
    }
    if (ORDERED.test(line)) {
      const items: string[] = [];
      while (ORDERED.test(lines[index] ?? '')) items.push(lines[index++].replace(ORDERED, ''));
      nodes.push(<ol key={index}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `ol${index}-${itemIndex}`)}</li>)}</ol>); continue;
    }
    const paragraph = [line]; index += 1;
    while (lines[index]?.trim() && !BLOCK_START.test(lines[index])) paragraph.push(lines[index++]);
    nodes.push(<p key={index}>{paragraph.map((item, itemIndex) => <span key={itemIndex}>{renderInline(item, `p${index}-${itemIndex}`)}{itemIndex < paragraph.length - 1 && <br/>}</span>)}</p>);
  }
  return <div className="markdown-document">{nodes}</div>;
}
