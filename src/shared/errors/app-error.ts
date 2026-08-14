export type AppError =
  | { code: 'INVALID_INPUT'; message: string }
  | { code: 'NOT_FOUND'; entity: string }
  | { code: 'INVALID_API_KEY' }
  | { code: 'MODEL_NOT_FOUND'; model: string }
  | { code: 'RATE_LIMITED'; retryAfter?: number }
  | { code: 'NETWORK_TIMEOUT' }
  | { code: 'INVALID_MODEL_OUTPUT'; message?: string }
  | { code: 'FILE_CONFLICT'; path: string }
  | { code: 'DATA_CORRUPTED'; path: string }
  | { code: 'IMPORT_REJECTED'; reason: string }
  | { code: 'TASK_ALREADY_RUNNING' }
  | { code: 'CANCELLED' }
  | { code: 'WEB_SEARCH_FAILED'; message: string }
  | { code: 'WEB_SOURCE_FAILED'; message: string }
  | { code: 'UNKNOWN'; message: string };

function defaultMessage(error: AppError): string {
  switch (error.code) {
    case 'INVALID_INPUT': return '输入不合法，请检查后重试。';
    case 'NOT_FOUND': return `未找到「${error.entity}」，可能已被移动或删除。`;
    case 'INVALID_API_KEY': return 'API Key 无效或已失效，请在设置中重新填写。';
    case 'MODEL_NOT_FOUND': return `模型「${error.model}」不存在，请在设置中更换模型。`;
    case 'RATE_LIMITED': return '请求过于频繁被限流，请稍后重试。';
    case 'NETWORK_TIMEOUT': return '网络请求失败或超时，请检查网络后重试。';
    case 'INVALID_MODEL_OUTPUT': return 'AI 返回的内容不符合预期，请重试。';
    case 'FILE_CONFLICT': return `文件冲突：${error.path}，请刷新后重试。`;
    case 'DATA_CORRUPTED': return `数据文件损坏：${error.path}，请从备份恢复。`;
    case 'IMPORT_REJECTED': return `导入被拒绝：${error.reason}`;
    case 'TASK_ALREADY_RUNNING': return '已有任务正在运行，请等待完成或取消后再试。';
    case 'CANCELLED': return '已取消本次生成。';
    case 'WEB_SEARCH_FAILED': return '联网搜索失败，请稍后重试。';
    case 'WEB_SOURCE_FAILED': return '读取网页来源失败，请稍后重试。';
    case 'UNKNOWN': return '发生未知错误，请重试。';
  }
}

export function appError(error: AppError): AppError & Error {
  const message = 'message' in error && error.message ? error.message : defaultMessage(error);
  return Object.assign(new Error(message), error, { message });
}
