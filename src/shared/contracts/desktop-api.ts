import type { Journal, Project, Review } from '../schemas/domain';
import type { CreateProjectInput, JournalQuery, SaveJournalInput } from '../schemas/ipc';
import type { PeriodicReviewInput, SaveProviderConfigInput } from '../schemas/ipc';
import type { PublicProviderConfig } from '../../main-process/infrastructure/ai/provider-config';
import type { DataDirectoryInfo } from '../../main-process/infrastructure/data-directory/data-directory-service';

export interface ZhijiDesktopApi {
  dataDirectory: { getInfo(): Promise<DataDirectoryInfo>; open(): Promise<void> };
  transfer: {
    exportBackup(): Promise<{ canceled: boolean; path?: string; fileCount?: number; totalBytes?: number }>;
    previewRestore(): Promise<{ canceled: boolean; previewId?: string; archivePath?: string; exportedAt?: string; appVersion?: string; fileCount?: number; totalBytes?: number; categories?: { journals: number; reviews: number; projects: number; settings: number } }>;
    restore(previewId: string): Promise<{ fileCount: number }>;
  };
  journals: {
    save(input: SaveJournalInput): Promise<Journal>;
    list(query?: JournalQuery): Promise<Journal[]>;
    get(id: string): Promise<Journal>;
  };
  projects: {
    create(input: CreateProjectInput): Promise<Project>;
    list(): Promise<Project[]>;
    archive(id: string): Promise<Project>;
  };
  settings: {
    getPublicConfig(): Promise<PublicProviderConfig>;
    save(input: SaveProviderConfigInput): Promise<PublicProviderConfig>;
    testConnection(input: SaveProviderConfigInput): Promise<void>;
  };
  reviews: {
    generateDaily(input: { journalId: string; regenerate?: boolean }): Promise<Review>;
    list(): Promise<Review[]>;
    cancel(): Promise<void>;
    preview(input: Omit<PeriodicReviewInput, 'previewToken'>): Promise<{ token: string; type: string; start: string; end: string; sources: { id: string; date: string; excerpt: string }[] }>;
    generatePeriodic(input: PeriodicReviewInput & { previewToken: string }): Promise<Review>;
  };
}
