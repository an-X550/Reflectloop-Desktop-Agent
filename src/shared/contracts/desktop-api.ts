import type { Journal, Project } from '../schemas/domain';
import type { CreateProjectInput, JournalQuery, SaveJournalInput } from '../schemas/ipc';

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
}
