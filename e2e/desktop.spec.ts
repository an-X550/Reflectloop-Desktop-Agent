import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('a non-CLI user completes the local journal loop', async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'zhiji-e2e-'));
  const executablePath = require('electron') as string;
  const app = await electron.launch({ executablePath, args: ['.'], cwd: process.cwd(), env: { ...process.env, ZHIJI_DATA_ROOT: dataRoot } });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '写下今天发生的事' })).toBeVisible();
    await page.getByRole('button', { name: '项目' }).click();
    await page.getByRole('button', { name: '新建第一个项目' }).click();
    await page.getByRole('textbox', { name: '项目名称' }).fill('桌面端验收');
    await page.getByRole('button', { name: '创建项目' }).click();
    await expect(page.getByText('桌面端验收').first()).toBeVisible();

    await page.getByRole('button', { name: '今天' }).click();
    await page.getByLabel('关联项目（可选）').selectOption({ label: '桌面端验收' });
    await page.getByRole('textbox', { name: '今日日志' }).fill('这是一条由桌面端自动化验收写入的本地日志。');
    await page.getByRole('button', { name: '仅保存日志' }).click();
    await expect(page.getByText('已保存到本机')).toBeVisible();

    await page.getByRole('button', { name: '历史' }).click();
    await expect(page.locator('pre')).toHaveText('这是一条由桌面端自动化验收写入的本地日志。');
    expect(await readFile(path.join(dataRoot, 'journals', new Date().getFullYear().toString(), `${new Date().toISOString().slice(0, 10)}.md`), 'utf8')).toContain('桌面端自动化验收');
  } finally {
    await app.close();
    await rm(dataRoot, { recursive: true, force: true });
  }
});
