import type { ReactNode } from 'react';

function stripFrontmatter(source: string) {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function table(lines: string[], key: number): ReactNode {
  const rows = lines.map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  return <div className="markdown-table-wrap" key={key}><table><thead><tr>{rows[0].map((cell, index) => <th key={index}>{cell}</th>)}</tr></thead><tbody>{rows.slice(2).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export function MarkdownDocument({ children }: { children: string }) {
  const lines = stripFrontmatter(children).split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (/^\|.*\|$/.test(line) && /^\|[\s:|-]+\|$/.test(lines[index + 1] ?? '')) {
      const block = [line, lines[index + 1]];
      index += 2;
      while (/^\|.*\|$/.test(lines[index] ?? '')) block.push(lines[index++]);
      nodes.push(table(block, index));
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6);
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      nodes.push(<Tag key={index}>{heading[2]}</Tag>); index += 1; continue;
    }
    if (line.startsWith('> ')) { nodes.push(<blockquote key={index}>{line.slice(2)}</blockquote>); index += 1; continue; }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (/^[-*]\s+/.test(lines[index] ?? '')) items.push(lines[index++].replace(/^[-*]\s+/, ''));
      nodes.push(<ul key={index}>{items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>); continue;
    }
    const paragraph = [line]; index += 1;
    while (lines[index]?.trim() && !/^(#{1,6})\s+|^> |^[-*]\s+|^\|.*\|$/.test(lines[index])) paragraph.push(lines[index++]);
    nodes.push(<p key={index}>{paragraph.map((item, itemIndex) => <span key={itemIndex}>{item}{itemIndex < paragraph.length - 1 && <br/>}</span>)}</p>);
  }
  return <div className="markdown-document">{nodes}</div>;
}
