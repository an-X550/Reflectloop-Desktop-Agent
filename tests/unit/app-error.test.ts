import { describe, expect, it } from 'vitest';
import { appError, type AppError } from '../../src/shared/errors/app-error';

const CHINESE = /[\u4e00-\u9fa5]/;

describe('appError 中文默认文案', () => {
  it.each([
    [{ code: 'INVALID_INPUT' } as AppError, '输入'],
    [{ code: 'NOT_FOUND', entity: 'journal_a1' } as AppError, 'journal_a1'],
    [{ code: 'INVALID_API_KEY' } as AppError, 'API Key'],
    [{ code: 'MODEL_NOT_FOUND', model: 'deepseek-chat' } as AppError, 'deepseek-chat'],
    [{ code: 'RATE_LIMITED' } as AppError, '限流'],
    [{ code: 'NETWORK_TIMEOUT' } as AppError, '网络'],
    [{ code: 'INVALID_MODEL_OUTPUT' } as AppError, 'AI'],
    [{ code: 'FILE_CONFLICT', path: 'journals/2026/a.md' } as AppError, '冲突'],
    [{ code: 'DATA_CORRUPTED', path: 'journals/2026/a.md' } as AppError, '损坏'],
    [{ code: 'IMPORT_REJECTED', reason: '重复数据' } as AppError, '拒绝'],
    [{ code: 'TASK_ALREADY_RUNNING' } as AppError, '任务'],
    [{ code: 'WEB_SEARCH_FAILED', message: '' } as AppError, '搜索'],
    [{ code: 'WEB_SOURCE_FAILED', message: '' } as AppError, '来源'],
    [{ code: 'UNKNOWN', message: '' } as AppError, '错误'],
  ])('为无 message 的 %o 提供中文默认文案，不暴露裸错误码', (input, keyword) => {
    const error = appError(input);
    expect(error.message).not.toBe(input.code);
    expect(error.message).toMatch(CHINESE);
    expect(error.message).toContain(keyword);
    expect(error.code).toBe(input.code);
  });

  it('显式传入的 message 优先于默认文案', () => {
    const error = appError({ code: 'INVALID_INPUT', message: '自定义文案。' });
    expect(error.message).toBe('自定义文案。');
    expect(error.code).toBe('INVALID_INPUT');
  });

  it('返回对象同时是 Error 实例并携带结构化字段', () => {
    const error = appError({ code: 'RATE_LIMITED', retryAfter: 30 });
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 30 });
  });
});
