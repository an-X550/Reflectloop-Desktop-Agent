import { z } from 'zod';

const RequestIdSchema = z.string().uuid();
const AgentSessionIdSchema = z.string().regex(/^agent_[a-z0-9]+$/);
const StableJournalId = z.string().regex(/^journal_[a-z0-9]+$/);
const StableReviewId = z.string().regex(/^review_[a-z0-9]+$/);
const StableProjectId = z.string().regex(/^project_[a-z0-9]+$/);
const SearchSessionIdSchema = z.string().regex(/^search_[a-z0-9]+$/);
const SourceIdSchema = z.string().regex(/^source_[a-z0-9]+$/);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const SafeText = z.string().trim().min(1).max(2_000);
const SafeExcerpt = z.string().trim().min(1).max(1_000);

export const AgentNavigationTargetSchema = z.union([
  z.object({ view: z.literal('start') }).strict(),
  z.object({ view: z.literal('journal'), intent: z.enum(['compose', 'records', 'generate-daily']).optional() }).strict(),
  z.object({ view: z.literal('reviews'), intent: z.enum(['weekly', 'monthly', 'yearly', 'coach']).optional() }).strict(),
  z.object({ view: z.literal('reviews'), intent: z.literal('project'), projectId: StableProjectId }).strict(),
  z.object({ view: z.literal('topics'), question: SafeText.optional() }).strict(),
  z.object({ view: z.literal('projects') }).strict(),
  z.object({ view: z.literal('settings') }).strict(),
]);

export const AgentPresentationCardSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: SafeExcerpt,
  links: z.array(z.object({ label: z.string().trim().min(1).max(80), target: AgentNavigationTargetSchema }).strict()).max(4),
}).strict();

const JournalListInputSchema = z.object({ start: IsoDate.optional(), end: IsoDate.optional(), projectId: StableProjectId.optional() }).strict();
const JournalGetInputSchema = z.object({ id: StableJournalId }).strict();
const ReviewGetInputSchema = z.object({ id: StableReviewId }).strict();
const TopicGetInputSchema = z.object({ topic: z.string().trim().min(1).max(80) }).strict();
const WebSearchInputSchema = z.object({ query: z.string().trim().min(1).max(500) }).strict();
const WebReadInputSchema = z.object({ searchSessionId: SearchSessionIdSchema, sourceId: SourceIdSchema }).strict();

export const AgentToolBridgeRequestSchema = z.discriminatedUnion('action', [
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('journals.list'), input: JournalListInputSchema }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('journals.get'), input: JournalGetInputSchema }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('reviews.list'), input: z.object({}).strict() }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('reviews.get'), input: ReviewGetInputSchema }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('projects.list'), input: z.object({}).strict() }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('topics.list'), input: z.object({}).strict() }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('topics.get'), input: TopicGetInputSchema }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('patterns.list'), input: z.object({}).strict() }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('web.search'), input: WebSearchInputSchema }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('web.read-source'), input: WebReadInputSchema }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('ui.navigate'), input: z.object({ target: AgentNavigationTargetSchema }).strict() }).strict(),
  z.object({ type: z.literal('tool.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, action: z.literal('ui.present'), input: AgentPresentationCardSchema }).strict(),
]);

const AgentJournalSummarySchema = z.object({ id: StableJournalId, date: IsoDate, projectIds: z.array(StableProjectId).max(20), excerpt: SafeExcerpt }).strict();
const AgentReviewSummarySchema = z.object({ id: StableReviewId, type: z.enum(['daily', 'weekly', 'monthly', 'project', 'coach', 'yearly', 'life-design']), periodStart: IsoDate, periodEnd: IsoDate, projectId: StableProjectId.nullable(), excerpt: SafeExcerpt }).strict();
const AgentProjectSummarySchema = z.object({ id: StableProjectId, name: z.string().trim().min(1).max(80), status: z.enum(['active', 'archived']) }).strict();
const AgentTopicSummarySchema = z.object({ topic: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(120), coreQuestion: SafeExcerpt, aliases: z.array(z.string().trim().min(1).max(80)).max(10) }).strict();
const AgentPatternSummarySchema = z.object({ id: z.string().regex(/^pattern_[a-z0-9]+$/), statement: SafeExcerpt, evidenceSummary: SafeExcerpt, sourceReviewIds: z.array(StableReviewId).max(20) }).strict();
const AgentSearchResultSchema = z.object({ sourceId: SourceIdSchema, title: z.string().trim().min(1).max(300), snippet: z.string().max(1_000) }).strict();

export const AgentToolResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('journals.list'), journals: z.array(AgentJournalSummarySchema).max(100) }).strict(),
  z.object({ kind: z.literal('journals.get'), journal: AgentJournalSummarySchema }).strict(),
  z.object({ kind: z.literal('reviews.list'), reviews: z.array(AgentReviewSummarySchema).max(100) }).strict(),
  z.object({ kind: z.literal('reviews.get'), review: AgentReviewSummarySchema }).strict(),
  z.object({ kind: z.literal('projects.list'), projects: z.array(AgentProjectSummarySchema).max(100) }).strict(),
  z.object({ kind: z.literal('topics.list'), topics: z.array(AgentTopicSummarySchema).max(100) }).strict(),
  z.object({ kind: z.literal('topics.get'), topic: z.object({ topic: z.string().trim().min(1).max(80), excerpt: SafeExcerpt }).strict() }).strict(),
  z.object({ kind: z.literal('patterns.list'), patterns: z.array(AgentPatternSummarySchema).max(100) }).strict(),
  z.object({ kind: z.literal('web.search'), searchSessionId: SearchSessionIdSchema, results: z.array(AgentSearchResultSchema).max(8) }).strict(),
  z.object({ kind: z.literal('web.read-source'), source: z.object({ title: z.string().trim().min(1).max(300), excerpt: z.string().max(2_000) }).strict() }).strict(),
  z.object({ kind: z.literal('ui.navigate'), target: AgentNavigationTargetSchema }).strict(),
  z.object({ kind: z.literal('ui.present'), card: AgentPresentationCardSchema }).strict(),
  z.object({ kind: z.literal('error'), message: z.string().trim().min(1).max(500) }).strict(),
]);

export const AgentToolBridgeResponseSchema = z.object({ type: z.literal('tool.result'), requestId: RequestIdSchema, result: AgentToolResultSchema }).strict();

export type AgentToolBridgeRequest = z.infer<typeof AgentToolBridgeRequestSchema>;
export type AgentToolResult = z.infer<typeof AgentToolResultSchema>;
export type AgentToolBridgeResponse = z.infer<typeof AgentToolBridgeResponseSchema>;
export type AgentNavigationTarget = z.infer<typeof AgentNavigationTargetSchema>;
export type AgentPresentationCard = z.infer<typeof AgentPresentationCardSchema>;
