import type { MessagePortMain } from 'electron';
import { DshRuntime, type UtilityMessagePort } from './dsh-runtime';

process.parentPort?.on('message', (event) => {
  const port = event.ports[0] as unknown as MessagePortMain | undefined;
  if (!port) return;
  const sessionRoot = typeof (event.data as { sessionRoot?: unknown } | undefined)?.sessionRoot === 'string'
    ? (event.data as { sessionRoot: string }).sessionRoot
    : undefined;
  const runtime = new DshRuntime(port as unknown as UtilityMessagePort, { sessionRoot });
  void runtime.start().catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    port.postMessage({
      type: 'runtime.error',
      message: `知己 Agent 初始化失败：${(detail || '未知运行时错误').slice(0, 450)}`,
    });
  });
});
