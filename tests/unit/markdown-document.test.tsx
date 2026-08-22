// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownDocument } from '../../src/renderer/components/markdown-document';

describe('MarkdownDocument', () => {
  it('renders common GFM blocks instead of exposing Markdown markers', () => {
    const source = ['---', 'title: ignored', '---', '# 结构化回复', '', '**重点**和 `代码`。', '', '- 第一项', '- 第二项', '', '> 一条引用', '', '| 项目 | 状态 |', '| --- | --- |', '| Agent | 正常 |', '', '```ts', 'const answer = true;', '```'].join('\n');
    const { container } = render(<MarkdownDocument>{source}</MarkdownDocument>);

    expect(container.querySelector('h1')).toHaveTextContent('结构化回复');
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelector('blockquote')).toHaveTextContent('一条引用');
    expect(container.querySelector('table')).toBeInTheDocument();
    expect(container.querySelector('pre code')).toHaveTextContent('const answer = true;');
    expect(container.querySelector('.markdown-document')).not.toHaveTextContent('```ts');
    expect(container.querySelector('.markdown-document')).not.toHaveTextContent('---');
  });

  it('does not execute raw HTML returned by the model', () => {
    const { container } = render(<MarkdownDocument>{'<script>window.__agentExecuted = true</script><p>文本</p>'}</MarkdownDocument>);
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('<script>window.__agentExecuted = true</script><p>文本</p>');
  });
});
