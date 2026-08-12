import type { Journal, Project } from '../schemas/domain';
import type { CreateProjectInput, JournalQuery, SaveJournalInput } from '../schemas/ipc';
import type { SaveProviderConfigInput } from '../schemas/ipc';
import type { PublicProviderConfig } from '../../main-process/infrastructure/ai/provider-config';

export interface ZhijiDesktopApi {
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
}
