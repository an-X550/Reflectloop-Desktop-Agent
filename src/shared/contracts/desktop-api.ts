import type { DailyGenerationResult, IntentResolution, Journal, PeriodicGenerationResult, Profile, Project, Review, TopicIndexEntry, TopicSession, VerifiedPattern, VerifiedPatternCandidate, WebSearchResult, WebSourceContent } from '../schemas/domain';
import type { ConfirmPatternInput, CreateJournalInput, CreateProjectInput, DiscussTopicInput, InsightReviewGenerateInput, InsightReviewPreviewInput, IntentResolveInput, JournalQuery, PeriodicReviewGenerateInput, PeriodicReviewPreviewInput, ProposePatternsInput, ReadWebSourceInput, RenameProjectInput, SaveProfileInput, SaveProviderConfigInput, StartTopicInput, TopicNameInput, TopicSessionInput, UpdateJournalInput, WebSearchInput } from '../schemas/ipc';
import type { PublicProviderConfig } from '../../main-process/infrastructure/ai/provider-config';
import type { DataDirectoryInfo } from '../../main-process/infrastructure/data-directory/data-directory-service';
import type { TopicSummaryProposal } from '../../main-process/application/topic-thinking';

export interface ZhijiDesktopApi {
  dataDirectory: { getInfo(): Promise<DataDirectoryInfo>; open(): Promise<void> };
  profile: { get(): Promise<Profile | null>; save(input: SaveProfileInput): Promise<Profile>; clear(): Promise<void> };
  transfer: {
    exportBackup(): Promise<{ canceled: boolean; path?: string; fileCount?: number; totalBytes?: number }>;
    previewRestore(): Promise<{ canceled: boolean; previewId?: string; archivePath?: string; exportedAt?: string; appVersion?: string; fileCount?: number; totalBytes?: number; categories?: { journals: number; reviews: number; projects: number; profile: number; settings: number } }>;
    restore(previewId: string): Promise<{ fileCount: number }>;
  };
  journals: {
    create(input: CreateJournalInput): Promise<Journal>;
    update(input: UpdateJournalInput): Promise<Journal>;
    list(query?: JournalQuery): Promise<Journal[]>;
    get(id: string): Promise<Journal>;
    delete(id: string): Promise<void>;
  };
  projects: {
    create(input: CreateProjectInput): Promise<Project>;
    list(): Promise<Project[]>;
    archive(id: string): Promise<Project>;
    rename(input: RenameProjectInput): Promise<Project>;
    restore(id: string): Promise<Project>;
    delete(id: string): Promise<void>;
  };
  settings: {
    getPublicConfig(): Promise<PublicProviderConfig>;
    save(input: SaveProviderConfigInput): Promise<PublicProviderConfig>;
    testConnection(input: SaveProviderConfigInput): Promise<void>;
    clearApiKey(): Promise<PublicProviderConfig>;
  };
  reviews: {
    generateDaily(input: { date: string; regenerate?: boolean }): Promise<DailyGenerationResult>;
    list(): Promise<Review[]>;
    cancel(): Promise<void>;
    preview(input: PeriodicReviewPreviewInput): Promise<{ token: string; type: string; start: string; end: string; sources: { id: string; date: string; excerpt: string }[] }>;
    generatePeriodic(input: PeriodicReviewGenerateInput): Promise<PeriodicGenerationResult>;
    previewInsight(input: InsightReviewPreviewInput): Promise<{ token: string; type: string; start: string; end: string; sources: { id: string; date: string; excerpt: string }[] }>;
    generateInsight(input: InsightReviewGenerateInput): Promise<Review>;
    delete(id: string): Promise<void>;
  };
  patterns: {
    list(): Promise<VerifiedPattern[]>;
    propose(input: ProposePatternsInput): Promise<VerifiedPatternCandidate[]>;
    confirm(input: ConfirmPatternInput): Promise<VerifiedPattern>;
  };
  topics: {
    start(input: StartTopicInput): Promise<{ sessionId: string; draft: string; referencedTopics: { topic: string; title: string }[] }>;
    discuss(input: DiscussTopicInput): Promise<{ reply: string }>;
    propose(input: TopicSessionInput): Promise<TopicSummaryProposal>;
    confirm(input: TopicSessionInput): Promise<{ topic: string }>;
    list(): Promise<TopicIndexEntry[]>;
    get(input: TopicNameInput): Promise<{ topic: string; body: string }>;
    sessions(): Promise<TopicSession[]>;
    resume(input: TopicSessionInput): Promise<TopicSession>;
  };
  web: {
    search(input: WebSearchInput): Promise<{ searchSessionId: string; results: WebSearchResult[] }>;
    readSource(input: ReadWebSourceInput): Promise<WebSourceContent>;
  };
  intent: { resolve(input: IntentResolveInput): Promise<IntentResolution> };
}
