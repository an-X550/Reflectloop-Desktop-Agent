// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from '../../src/renderer/pages/projects-page';
import type { Journal, Project } from '../../src/shared/schemas/domain';

const project: Project = { schemaVersion: 1, id: 'project_a1', name: '知己客户端', status: 'active', createdAt: '2026-08-01T00:00:00.000Z', archivedAt: null };
const journal: Journal = { schemaVersion: 1, id: 'journal_a1', date: '2026-08-12', createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z', projectIds: ['project_a1'], body: '项目日志' };
beforeEach(() => { window.zhiji = { projects: { create: vi.fn(async ({ name }) => ({ ...project, name })), archive: vi.fn(async () => ({ ...project, status: 'archived' })), list: vi.fn() } } as unknown as Window['zhiji']; });

describe('ProjectsPage', () => {
  it('creates a project through an accessible modal instead of window.prompt', async () => {
    const refresh = vi.fn(); render(<ProjectsPage projects={[]} journals={[]} onRefresh={refresh} onNavigate={vi.fn()}/>); fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
    expect(screen.getByRole('dialog', { name: '新建项目' })).toBeInTheDocument(); const input = screen.getByLabelText('项目名称'); expect(input).toHaveFocus(); fireEvent.change(input, { target: { value: '求职准备' } }); fireEvent.click(screen.getByRole('button', { name: '创建项目' }));
    await waitFor(() => expect(window.zhiji.projects.create).toHaveBeenCalledWith({ name: '求职准备' })); expect(refresh).toHaveBeenCalled();
  });
  it('shows linked metrics and asks before archiving without deleting journals', async () => {
    render(<ProjectsPage projects={[project]} journals={[journal]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>); expect(screen.getByRole('heading', { name: '项目与关联日志' })).toBeInTheDocument(); expect(screen.getByText('1 篇关联日志')).toBeInTheDocument(); expect(screen.getByText(/最近活动：2026-08-12/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '归档项目' })); expect(screen.getByText('归档不会删除任何日志。')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: '确认归档' })); await waitFor(() => expect(window.zhiji.projects.archive).toHaveBeenCalledWith('project_a1'));
  });
  it('starts a review with the selected project context', () => {
    const navigate = vi.fn(); render(<ProjectsPage projects={[project]} journals={[journal]} onRefresh={vi.fn()} onNavigate={navigate}/>);
    fireEvent.click(screen.getByRole('button', { name: '发起项目复盘' }));
    expect(navigate).toHaveBeenCalledWith({ view: 'reviews', intent: { type: 'review.project', projectId: 'project_a1' } });
  });
  it('does not offer a new review for an archived project', () => {
    render(<ProjectsPage projects={[{ ...project, status: 'archived' }]} journals={[journal]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    expect(screen.queryByRole('button', { name: '发起项目复盘' })).not.toBeInTheDocument();
  });
  it('closes the modal with Escape', () => { render(<ProjectsPage projects={[]} journals={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>); fireEvent.click(screen.getByRole('button', { name: '新建项目' })); fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); });
});
