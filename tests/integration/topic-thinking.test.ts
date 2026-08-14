import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopicThinkingService } from '../../src/main-process/application/topic-thinking';
import { TopicRepository } from '../../src/main-process/infrastructure/topics/topic-repository';
import { TopicSessionStore } from '../../src/main-process/infrastructure/topics/topic-session-store';

const summaryJson = JSON.stringify({
  title: '职业选择', coreQuestion: '化债背景下选什么行业？', aliases: ['行业选择'],
  body: '# 职业选择\n\n## 当前判断\n\n重组后的整篇论证。',
});

describe('TopicThinkingService integration (file checkpoint)', () => {
  let root: string;
  let responses: string[];
  let callIndex: number;
  let topics: TopicRepository;
  let sessions: TopicSessionStore;
  let service: TopicThinkingService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'zhiji-topic-integration-'));
    responses = [];
    callIndex = 0;
    topics = new TopicRepository(root);
    sessions = new TopicSessionStore(root);
    service = new TopicThinkingService(topics, sessions, { collect: vi.fn(async () => responses[callIndex++]) });
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('runs context-injected start → discuss → merged-update propose → confirm write', async () => {
    await topics.saveTopic({ title: '职业选择', coreQuestion: '化债背景下选什么行业？', aliases: ['行业选择'], body: '# 职业选择\n\n## 当前判断\n\n旧论证。' });
    responses = ['首稿回答', '追问回复', summaryJson, summaryJson];

    const started = await service.start({ question: '化债背景下我该选什么行业？', model: 'fake', contextExcerpt: '日反馈提到现金流紧张。' });
    await service.discuss({ sessionId: started.sessionId, message: '我还有六个月存款', model: 'fake' });
    const proposal = await service.proposeSummary({ sessionId: started.sessionId, model: 'fake' });

    expect(proposal.mode).toBe('update');
    expect(proposal.targetTopic).toBe('职业选择');
    expect(proposal.existingBody).toContain('旧论证');
    expect(proposal.summary.body).toContain('重组后的整篇论证');

    const confirmed = await service.confirm({ sessionId: started.sessionId });
    expect(confirmed.topic).toBe('职业选择');
    expect(await topics.getTopic('职业选择')).toContain('重组后的整篇论证');
    expect(await sessions.load(started.sessionId)).toBeNull();
  });

  it('keeps the proposal confirmable across an application restart', async () => {
    await topics.saveTopic({ title: '职业选择', coreQuestion: '化债背景下选什么行业？', aliases: ['行业选择'], body: '# 职业选择\n\n旧论证。' });
    responses = ['首稿回答', summaryJson, summaryJson];
    const started = await service.start({ question: '化债背景下我该选什么行业？', model: 'fake' });
    const proposal = await service.proposeSummary({ sessionId: started.sessionId, model: 'fake' });
    expect(proposal.mode).toBe('update');

    // Simulate an app restart: brand-new service and store instances bound to the same on-disk root.
    const restarted = new TopicThinkingService(topics, new TopicSessionStore(root), { collect: vi.fn(async () => responses[callIndex++]) });
    const confirmed = await restarted.confirm({ sessionId: started.sessionId });
    expect(confirmed.topic).toBe('职业选择');
    expect(await topics.getTopic('职业选择')).toContain('重组后的整篇论证');
  });
});
