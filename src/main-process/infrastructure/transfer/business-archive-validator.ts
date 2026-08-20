import matter from 'gray-matter';
import { Session, SessionId, type SessionEvent, type SessionHeader } from '@deepseek-ai/dsh-session';
import { appError } from '../../../shared/errors/app-error';
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
      else if (filePath.startsWith('agent/sessions/')) validateAgentSession(filePath, content);
    } catch { throw appError({ code: 'IMPORT_REJECTED', reason: `备份中的业务数据无效：${filePath}` }); }
  }
  for (const item of journalProjects) for (const id of item.ids) if (!projects.has(id)) throw appError({ code: 'IMPORT_REJECTED', reason: `备份中的项目关系无效：${item.path} -> ${id}` });
  const sourceIds = new Set([...journals, ...projects, ...reviews.map((item) => item.id)]);
  for (const review of reviews) {
    if (review.projectId && !projects.has(review.projectId)) throw appError({ code: 'IMPORT_REJECTED', reason: `备份中的项目关系无效：${review.path} -> ${review.projectId}` });
    for (const id of review.sourceIds) if (!sourceIds.has(id)) throw appError({ code: 'IMPORT_REJECTED', reason: `备份中的来源关系无效：${review.path} -> ${id}` });
  }
}

/** Validate the published DSH JSONL event log before a backup is accepted. */
function validateAgentSession(filePath: string, content: Buffer): void {
  const parts = filePath.split('/');
  if (parts.length !== 5 || parts[4] !== 'session.jsonl') throw new Error('invalid agent session path');
  const text = content.toString('utf8');
  if (!text.endsWith('\n')) throw new Error('agent session log is missing its final newline');
  const lines = text.split('\n').filter((line) => line.length > 0).map((line) => JSON.parse(line) as Record<string, unknown>);
  const rawHeader = lines.shift();
  if (!rawHeader || rawHeader.type !== 'session' || typeof rawHeader.id !== 'string' || !rawHeader.id.match(/^agent_[a-z0-9]+$/) || parts[3] !== rawHeader.id || typeof rawHeader.version !== 'number' || typeof rawHeader.createdAt !== 'number' || typeof rawHeader.delegationDepth !== 'number') throw new Error('invalid agent session header');
  const header: SessionHeader = {
    version: rawHeader.version,
    id: SessionId(rawHeader.id),
    createdAt: rawHeader.createdAt,
    ...(typeof rawHeader.cwd === 'string' ? { cwd: rawHeader.cwd } : {}),
    ...(typeof rawHeader.parentSession === 'string' ? { parentSession: SessionId(rawHeader.parentSession) } : {}),
    ...(typeof rawHeader.seedLength === 'number' ? { seedLength: rawHeader.seedLength } : {}),
    ...(rawHeader.origin === 'subagent' ? { origin: 'subagent' as const } : {}),
    delegationDepth: rawHeader.delegationDepth,
    ...(typeof rawHeader.agentPreset === 'string' ? { agentPreset: rawHeader.agentPreset } : {}),
  };
  Session.fromRestore(header.id, lines as unknown as SessionEvent[], header);
}
