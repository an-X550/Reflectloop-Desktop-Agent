import type { BackupExportOutcome, DailyGenerationResult, DataDirectoryInfo, Journal, PeriodicGenerationResult, Profile, Project, PublicProviderConfig, RestorePreviewOutcome, RestoreResult, Review, ReviewPreview, TopicConfirmResult, TopicContent, TopicDiscussResult, TopicIndexEntry, TopicProposal, TopicSession, TopicStartResult, VerifiedPattern, VerifiedPatternCandidate, WebSearchResult, WebSourceContent } from '../schemas/domain';
import type { ConfirmPatternInput, CreateJournalInput, CreateProjectInput, DiscussTopicInput, InsightReviewGenerateInput, InsightReviewPreviewInput, JournalQuery, PeriodicReviewGenerateInput, PeriodicReviewPreviewInput, ProposePatternsInput, ReadWebSourceInput, RenameProjectInput, SaveProfileInput, SaveProviderConfigInput, StartTopicInput, TopicNameInput, TopicSessionInput, UpdateJournalInput, WebSearchInput } from '../schemas/ipc';

export interface ZhijiDesktopApi {
  dataDirectory: { getInfo(): Promise<DataDirectoryInfo>; open(): Promise<void> };
  profile: { get(): Promise<Profile | null>; save(input: SaveProfileInput): Promise<Profile>; clear(): Promise<void> };
  transfer: {
    exportBackup(): Promise<BackupExportOutcome>;
    previewRestore(): Promise<RestorePreviewOutcome>;
    restore(previewId: string): Promise<RestoreResult>;
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
    preview(input: PeriodicReviewPreviewInput): Promise<ReviewPreview>;
    generatePeriodic(input: PeriodicReviewGenerateInput): Promise<PeriodicGenerationResult>;
    previewInsight(input: InsightReviewPreviewInput): Promise<ReviewPreview>;
    generateInsight(input: InsightReviewGenerateInput): Promise<Review>;
    delete(id: string): Promise<void>;
    /** 订阅生成任务阶段进度（building_context/generating/validating/saving…），返回取消订阅函数。 */
    onTaskPhase(listener: (phase: string) => void): () => void;
  };
  patterns: {
    list(): Promise<VerifiedPattern[]>;
    propose(input: ProposePatternsInput): Promise<VerifiedPatternCandidate[]>;
    confirm(input: ConfirmPatternInput): Promise<VerifiedPattern>;
  };
  topics: {
    start(input: StartTopicInput): Promise<TopicStartResult>;
    discuss(input: DiscussTopicInput): Promise<TopicDiscussResult>;
    propose(input: TopicSessionInput): Promise<TopicProposal>;
    confirm(input: TopicSessionInput): Promise<TopicConfirmResult>;
    list(): Promise<TopicIndexEntry[]>;
    get(input: TopicNameInput): Promise<TopicContent>;
    sessions(): Promise<TopicSession[]>;
    resume(input: TopicSessionInput): Promise<TopicSession>;
    /** 订阅主题讨论的流式增量文本，返回取消订阅函数。 */
    onStream(listener: (delta: string) => void): () => void;
  };
  web: {
    search(input: WebSearchInput): Promise<{ searchSessionId: string; results: WebSearchResult[] }>;
    readSource(input: ReadWebSourceInput): Promise<WebSourceContent>;
  };
}
