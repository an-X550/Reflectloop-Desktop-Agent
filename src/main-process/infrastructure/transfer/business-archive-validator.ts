import matter from 'gray-matter';
import { JournalSchema, ProfileSchema, ProjectSchema, ReviewSchema } from '../../../shared/schemas/domain';
import { ProviderConfigSchema } from '../ai/provider-config';

export function validateBusinessArchive(files: Map<string, Buffer>): void {
  const journals = new Set<string>(); const projects = new Set<string>(); const reviews: { id: string; projectId: string | null; sourceIds: string[]; path: string }[] = []; const journalProjects: { ids: string[]; path: string }[] = [];
  for (const [filePath, content] of files) {
    try {
      if (filePath.startsWith('journals/')) { const parsed = matter(content.toString('utf8')); const item = JournalSchema.parse({ schemaVersion: parsed.data.schema_version, id: parsed.data.id, date: parsed.data.date, createdAt: parsed.data.created_at, updatedAt: parsed.data.updated_at, projectIds: parsed.data.project_ids ?? [], body: parsed.content.trim() }); if (journals.has(item.id)) throw new Error('duplicate journal id'); journals.add(item.id); journalProjects.push({ ids: item.projectIds, path: filePath }); }
      else if (filePath.startsWith('projects/')) projects.add(ProjectSchema.parse(JSON.parse(content.toString('utf8'))).id);
      else if (filePath.startsWith('reviews/')) { const parsed = matter(content.toString('utf8')); const item = ReviewSchema.parse({ ...parsed.data, body: parsed.content.trim() }); reviews.push({ id: item.id, projectId: item.projectId, sourceIds: item.sourceIds, path: filePath }); }
      else if (filePath === 'profile/about-me.md') { const parsed = matter(content.toString('utf8')); ProfileSchema.parse({ schemaVersion: parsed.data.schema_version, body: parsed.content.trim(), enabledForAi: parsed.data.enabled_for_ai, createdAt: parsed.data.created_at, updatedAt: parsed.data.updated_at }); }
      else if (filePath === 'settings.json') ProviderConfigSchema.parse(JSON.parse(content.toString('utf8')));
    } catch { throw new Error(`备份中的业务数据无效：${filePath}`); }
  }
  for (const item of journalProjects) for (const id of item.ids) if (!projects.has(id)) throw new Error(`备份中的项目关系无效：${item.path} -> ${id}`);
  const sourceIds = new Set([...journals, ...projects, ...reviews.map((item) => item.id)]);
  for (const review of reviews) {
    if (review.projectId && !projects.has(review.projectId)) throw new Error(`备份中的项目关系无效：${review.path} -> ${review.projectId}`);
    for (const id of review.sourceIds) if (!sourceIds.has(id)) throw new Error(`备份中的来源关系无效：${review.path} -> ${id}`);
  }
}
