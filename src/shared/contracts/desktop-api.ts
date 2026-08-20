import type { BackupExportOutcome, DailyGenerationResult, DataDirectoryInfo, Journal, JournalTemplate, PeriodicGenerationResult, Profile, Project, PublicProviderConfig, RestorePreviewOutcome, RestoreResult, Review, ReviewPreview, TopicConfirmResult, TopicContent, TopicDiscussResult, TopicIndexEntry, TopicProposal, TopicSession, TopicStartResult, VerifiedPattern, VerifiedPatternCandidate, WebSearchResult, WebSourceContent } from '../schemas/domain';
import type { AgentEvent, AgentSession } from '../schemas/agent';
import type { AgentConfirmInput, AgentSendInput, AgentSessionInput, AgentStartInput, ChangeDataRootInput, ConfirmPatternInput, CreateJournalInput, CreateProjectInput, DiscussTopicInput, InsightReviewGenerateInput, InsightReviewPreviewInput, JournalQuery, PeriodicReviewGenerateInput, PeriodicReviewPreviewInput, ProposePatternsInput, ReadWebSourceInput, RenameProjectInput, SaveProfileInput, SaveProviderConfigInput, SaveTemplateInput, StartTopicInput, TopicNameInput, TopicSessionInput, UpdateJournalInput, WebSearchInput } from '../schemas/ipc';

export interface ZhijiDesktopApi {
  agent: {
    start(input?: AgentStartInput): Promise<AgentSession>;
    send(input: AgentSendInput): Promise<void>;
    cancel(input: AgentSessionInput): Promise<void>;
    confirm(input: AgentConfirmInput): Promise<void>;
    list(): Promise<AgentSession[]>;
    get(input: AgentSessionInput): Promise<AgentSession>;
    onEvent(listener: (event: AgentEvent) => void): () => void;
  };
  dataDirectory: {
    getInfo(): Promise<DataDirectoryInfo>;
    open(): Promise<void>;
    /** 弹出系统文件夹选择器，返回所选路径。 */
    pickFolder(): Promise<{ canceled: true } | { canceled: false; path: string }>;
    /** 更改数据存储位置；move=true 时把现有数据复制到新位置。需要重启生效。 */
    changeLocation(input: ChangeDataRootInput): Promise<{ moved: boolean; from: string; to: string }>;
  };
  templates: {
    list(): Promise<JournalTemplate[]>;
    get(name: string): Promise<JournalTemplate>;
    save(input: SaveTemplateInput): Promise<JournalTemplate>;
    delete(name: string): Promise<void>;
  };
  app: {
    /** 当前应用版本与构建信息（用于"关于"展示与更新检查）。 */
    getInfo(): Promise<{ version: string; updateUrl: string | null }>;
    /** 设置或清空发布地址（用于"检查更新"打开浏览器）。 */
    setUpdateUrl(url: string | null): Promise<void>;
  };
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
