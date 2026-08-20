import { parentPort, type MessagePortMain } from 'electron';
import { DshRuntime, type UtilityMessagePort } from './dsh-runtime';

parentPort.on('message', (event) => {
  const port = event.ports[0] as unknown as MessagePortMain | undefined;
  if (!port) return;
  const sessionRoot = typeof (event.data as { sessionRoot?: unknown } | undefined)?.sessionRoot === 'string'
    ? (event.data as { sessionRoot: string }).sessionRoot
    : undefined;
  const runtime = new DshRuntime(port as unknown as UtilityMessagePort, { sessionRoot });
  void runtime.start().catch(() => {
    port.postMessage({ type: 'runtime.error', message: '知己 Agent 无法启动，请稍后重试。' });
  });
});
