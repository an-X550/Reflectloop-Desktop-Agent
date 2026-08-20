import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { OpenAiCompatibleProvider } from '../../src/main-process/infrastructure/ai/openai-compatible-provider';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(() => servers.splice(0).forEach((server) => server.close()));

async function endpoint(status: number, body: string, contentType = 'application/json') {
  const server = createServer((_request, response) => {
    response.writeHead(status, { 'content-type': contentType });
    response.end(body);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server port');
  return `http://127.0.0.1:${address.port}/v1`;
}

async function inspectingEndpoint(onBody: (body: unknown) => void, responseBody: string) {
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => { onBody(JSON.parse(raw)); response.writeHead(200, { 'content-type': 'text/event-stream' }); response.end(responseBody); });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server port');
  return `http://127.0.0.1:${address.port}/v1`;
}

async function inspectingJsonEndpoint(onBody: (body: unknown) => void) {
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => { onBody(JSON.parse(raw)); response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }] })); });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server port');
  return `http://127.0.0.1:${address.port}/v1`;
}

describe('OpenAiCompatibleProvider', () => {
  it.each([[401, 'INVALID_API_KEY'], [404, 'MODEL_NOT_FOUND'], [429, 'RATE_LIMITED']] as const)('maps HTTP %s to %s', async (status, code) => {
    const baseUrl = await endpoint(status, '{}');
    const provider = new OpenAiCompatibleProvider({ baseUrl, model: 'fake', apiKey: 'x' });
    await expect(provider.collect([{ role: 'user', content: 'hello' }])).rejects.toMatchObject({ code });
  });

  it('parses compatible SSE deltas', async () => {
    const body = 'data: {"choices":[{"delta":{"content":"你"}}]}\n\ndata: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: [DONE]\n\n';
    const baseUrl = await endpoint(200, body, 'text/event-stream');
    const provider = new OpenAiCompatibleProvider({ baseUrl, model: 'fake', apiKey: 'x' });
    await expect(provider.collect([{ role: 'user', content: 'hello' }])).resolves.toBe('你好');
  });

  it('skips malformed SSE frames instead of failing the whole generation', async () => {
    const body = 'data: {"choices":[{"delta":{"content":"你"}}]}\n\ndata: {broken-json!!\n\ndata: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: [DONE]\n\n';
    const baseUrl = await endpoint(200, body, 'text/event-stream');
    const provider = new OpenAiCompatibleProvider({ baseUrl, model: 'fake', apiKey: 'x' });
    await expect(provider.collect([{ role: 'user', content: 'hello' }])).resolves.toBe('你好');
  });

  it('preserves streamed tool-call arguments when later frames omit the call id', async () => {
    const body = 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"zhiji.journals.get","arguments":"{\\"id\\":\\"journal_"}}]}}]}\n\ndata: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"a1\\"}"}}]}}]}\n\ndata: [DONE]\n\n';
    const baseUrl = await endpoint(200, body, 'text/event-stream');
    const provider = new OpenAiCompatibleProvider({ baseUrl, model: 'fake', apiKey: 'x' });
    const frames = [];
    for await (const frame of provider.streamAgent([{ role: 'user', content: '读取日志' }], [{ name: 'zhiji.journals.get', description: '读取日志', parameters: { type: 'object' } }])) frames.push(frame);
    expect(frames).toEqual([
      { kind: 'tool-call', index: 0, callId: 'call_1', name: 'zhiji.journals.get', argumentsDelta: '{"id":"journal_' },
      { kind: 'tool-call', index: 0, callId: 'call_1', argumentsDelta: 'a1"}' },
    ]);
  });

  it('requests JSON object mode only for structured generations', async () => {
    let requestBody: unknown;
    const body = 'data: {"choices":[{"delta":{"content":"{}"}}]}\n\ndata: [DONE]\n\n';
    const baseUrl = await inspectingEndpoint((value) => { requestBody = value; }, body);
    const provider = new OpenAiCompatibleProvider({ baseUrl, model: 'deepseek-chat', apiKey: 'x' });
    await provider.collect([{ role: 'user', content: 'Return JSON.' }], undefined, { jsonObject: true });
    expect(requestBody).toMatchObject({ response_format: { type: 'json_object' } });
  });

  it('tests connectivity with a bounded non-stream request', async () => {
    let requestBody: unknown;
    const baseUrl = await inspectingJsonEndpoint((value) => { requestBody = value; });
    const provider = new OpenAiCompatibleProvider({ baseUrl, model: 'deepseek-v4-flash', apiKey: 'x' });
    await expect(provider.testConnection()).resolves.toBeUndefined();
    expect(requestBody).toMatchObject({ model: 'deepseek-v4-flash', stream: false, max_tokens: 1 });
  });
});
