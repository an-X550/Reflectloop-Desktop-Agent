// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopicsPage } from '../../src/renderer/pages/topics-page';

const entry = { topic: '职业选择', title: '职业选择', coreQuestion: '化债下选什么行业', aliases: [], updatedAt: '2026-08-10T08:00:00.000Z' };
const session = { schemaVersion: 1 as const, id: 'topicsession_abc123', question: '化债周期下选什么行业？', referencedTopics: [], messages: [
  { role: 'user' as const, content: '旧问题', at: '2026-08-12T08:00:00.000Z' },
  { role: 'assistant' as const, content: '旧回答', at: '2026-08-12T08:01:00.000Z' },
], createdAt: '2026-08-12T08:00:00.000Z', updatedAt: '2026-08-12T08:01:00.000Z' };

const searchResult = { sourceId: 'source_a1b2', title: '化债周期分析', url: 'https://example.com/article', snippet: '摘要内容', publishedAt: null, retrievedAt: '2026-08-14T06:00:00.000Z' };

beforeEach(() => {
  window.zhiji = {
    topics: {
      list: vi.fn(async () => [entry]),
      sessions: vi.fn(async () => [session]),
      get: vi.fn(async () => ({ topic: '职业选择', body: '既有主题正文' })),
      start: vi.fn(async () => ({ sessionId: 'topicsession_new1', draft: '首稿回答', referencedTopics: [{ topic: '职业选择', title: '职业选择' }] })),
      discuss: vi.fn(async () => ({ reply: '继续讨论回复' })),
      propose: vi.fn(async () => ({ mode: 'update' as const, targetTopic: '职业选择', existingBody: '旧正文', summary: { title: '职业选择', coreQuestion: '化债下选什么行业', aliases: [], body: '新归纳正文' } })),
      confirm: vi.fn(async () => ({ topic: '职业选择' })),
      resume: vi.fn(async () => session),
    },
    web: {
      search: vi.fn(async () => ({ searchSessionId: 'search_s1', results: [searchResult] })),
      readSource: vi.fn(async () => ({ title: '来源标题', url: 'https://example.com/article', publishedAt: null, excerpt: '正文摘录' })),
    },
  } as unknown as Window['zhiji'];
  vi.clearAllMocks();
});

describe('TopicsPage', () => {
  it('lists settled topics and recoverable sessions on load', async () => {
    render(<TopicsPage/>);
    expect(await screen.findByText('职业选择')).toBeInTheDocument();
    expect(screen.getByText('化债周期下选什么行业？')).toBeInTheDocument();
    expect(window.zhiji.topics.sessions).toHaveBeenCalled();
  });

  it('starts a discussion only on explicit user action and shows the draft', async () => {
    render(<TopicsPage/>);
    fireEvent.change(screen.getByLabelText('主题问题'), { target: { value: '化债周期下选什么行业？' } });
    fireEvent.click(screen.getByRole('button', { name: '开始讨论' }));
    expect(await screen.findByText('首稿回答')).toBeInTheDocument();
    expect(window.zhiji.topics.start).toHaveBeenCalledWith({ question: '化债周期下选什么行业？' });
    expect(screen.getByText(/参考了既有主题：职业选择/)).toBeInTheDocument();
  });

  it('appends discussion turns through the session', async () => {
    render(<TopicsPage/>);
    fireEvent.change(screen.getByLabelText('主题问题'), { target: { value: '化债周期下选什么行业？' } });
    fireEvent.click(screen.getByRole('button', { name: '开始讨论' }));
    await screen.findByText('首稿回答');
    fireEvent.change(screen.getByLabelText('继续讨论'), { target: { value: '新反例' } });
    fireEvent.click(screen.getByRole('button', { name: '继续讨论' }));
    expect(await screen.findByText('继续讨论回复')).toBeInTheDocument();
    expect(window.zhiji.topics.discuss).toHaveBeenCalledWith({ sessionId: 'topicsession_new1', message: '新反例' });
  });

  it('shows the diff against the existing topic and persists only after explicit confirmation', async () => {
    render(<TopicsPage/>);
    fireEvent.change(screen.getByLabelText('主题问题'), { target: { value: '化债周期下选什么行业？' } });
    fireEvent.click(screen.getByRole('button', { name: '开始讨论' }));
    await screen.findByText('首稿回答');
    fireEvent.click(screen.getByRole('button', { name: '生成主题归纳' }));
    expect(await screen.findByText(/更新既有主题：职业选择/)).toBeInTheDocument();
    expect(screen.getByText('旧正文')).toBeInTheDocument();
    expect(window.zhiji.topics.confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确认沉淀' }));
    await waitFor(() => expect(window.zhiji.topics.confirm).toHaveBeenCalledWith({ sessionId: 'topicsession_new1' }));
    expect(await screen.findByText(/已沉淀到主题《职业选择》/)).toBeInTheDocument();
  });

  it('resumes a checkpointed session instead of starting over', async () => {
    render(<TopicsPage/>);
    fireEvent.click(await screen.findByRole('button', { name: '化债周期下选什么行业？' }));
    expect(await screen.findByText('旧回答')).toBeInTheDocument();
    expect(window.zhiji.topics.resume).toHaveBeenCalledWith({ sessionId: 'topicsession_abc123' });
    expect(window.zhiji.topics.start).not.toHaveBeenCalled();
  });

  it('searches the web only when the user triggers it and shows source and date', async () => {
    render(<TopicsPage/>);
    expect(window.zhiji.web.search).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: '化债周期' } });
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(await screen.findByText('化债周期分析')).toBeInTheDocument();
    expect(screen.getByText(/来源 example\.com · 检索于 2026-08-14/)).toBeInTheDocument();
    expect(window.zhiji.web.search).toHaveBeenCalledWith({ query: '化债周期' });
  });

  it('reads a source with the search-session-bound sourceId', async () => {
    render(<TopicsPage/>);
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: '化债周期' } });
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    fireEvent.click(await screen.findByRole('button', { name: '阅读原文' }));
    expect(await screen.findByText('正文摘录')).toBeInTheDocument();
    expect(window.zhiji.web.readSource).toHaveBeenCalledWith({ searchSessionId: 'search_s1', sourceId: 'source_a1b2' });
  });
});
