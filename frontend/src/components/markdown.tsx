import React from 'react';

/**
 * Minimal markdown renderer for AI-generated documents.
 *
 * Deliberately hand-rolled rather than a library plus `dangerouslySetInnerHTML`:
 * this text comes back from a language model, so treating it as HTML would let a
 * prompt-injected response inject script into the page. Everything here is built
 * as React elements, so the content can only ever render as text.
 *
 * Covers what language models actually return: headings, bold, italic, inline
 * code, links (shown as their text only: a model-made link is never clickable),
 * bullet and numbered lists (numbering kept across blank lines), tables,
 * blockquotes and horizontal rules. Anything unrecognised falls through as a
 * plain paragraph, so raw syntax never reaches the reader.
 */

// **bold** / __bold__ | `code` | [text](url) | *italic* / _italic_
const INLINE = /(\*\*|__)(.+?)\1|`([^`\n]+)`|\[([^\]\n]+)\]\([^)\s]*\)|(?<![\w*])\*(?![\s*])([^*\n]+?)\*(?![\w*])|(?<![\w_])_(?![\s_])([^_\n]+?)_(?![\w_])/g;

/** Turns one line of model text into React nodes (bold, italic, code, link text). */
function renderInline(raw: string, keyPrefix: string): React.ReactNode[] {
  // Models sometimes put HTML line breaks inside table cells or list items.
  const text = raw.replace(/<br\s*\/?>/gi, ' ');
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;
  let match: RegExpExecArray | null;
  // A fresh pattern per call: bold text is rendered recursively, and a shared
  // global pattern's position would be reset by the inner call (endless loop).
  const pattern = new RegExp(INLINE.source, 'g');
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const key = `${keyPrefix}-i${i++}`;
    if (match[2] !== undefined) nodes.push(<strong key={key} className="font-semibold text-slate-900">{renderInline(match[2], key)}</strong>);
    else if (match[3] !== undefined) nodes.push(<code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">{match[3]}</code>);
    else if (match[4] !== undefined) nodes.push(match[4]);
    else nodes.push(<em key={key}>{match[5] ?? match[6]}</em>);
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** One short piece of model text (a list item, a note) without block formatting. */
export function InlineMarkdown({ text }: { text: string }): JSX.Element {
  return <>{renderInline(String(text ?? '').replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, ''), 'inl')}</>;
}

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className = '' }: MarkdownProps): JSX.Element {
  const lines = String(content ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];

  // Consecutive list items are gathered so they render as one <ul>/<ol>. A blank
  // line between items (common in model output) does not restart the list, and
  // a numbered list keeps the model's own starting number.
  let listBuffer: { ordered: boolean; start: number; items: string[] } | null = null;

  const flushList = () => {
    if (!listBuffer) return;
    const { ordered, start, items } = listBuffer;
    const key = `list-${blocks.length}`;
    const rendered = items.map((item, i) => (
      <li key={`${key}-${i}`} className="ml-1 pl-1">{renderInline(item, `${key}-${i}`)}</li>
    ));
    blocks.push(
      ordered
        ? <ol key={key} start={start} className="my-2 list-decimal space-y-1 pl-5 text-slate-700">{rendered}</ol>
        : <ul key={key} className="my-2 list-disc space-y-1 pl-5 text-slate-700">{rendered}</ul>,
    );
    listBuffer = null;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trimEnd();
    const key = `md-${idx}`;

    if (!line.trim()) continue;

    const bullet = /^\s*[-*+•]\s+(.*)$/.exec(line);
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (bullet && !/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      if (listBuffer?.ordered) flushList();
      if (!listBuffer) listBuffer = { ordered: false, start: 1, items: [] };
      listBuffer.items.push(bullet[1]);
      continue;
    }
    if (numbered) {
      if (listBuffer && !listBuffer.ordered) flushList();
      if (!listBuffer) listBuffer = { ordered: true, start: Number(numbered[1]) || 1, items: [] };
      listBuffer.items.push(numbered[2]);
      continue;
    }
    // Anything else ends a list (a blank line alone does not).
    flushList();

    // Table: a header row, a divider row, then body rows.
    if (TABLE_ROW.test(line) && idx + 1 < lines.length && TABLE_DIVIDER.test(lines[idx + 1])) {
      const header = cells(line);
      const body: string[][] = [];
      idx += 2;
      while (idx < lines.length && TABLE_ROW.test(lines[idx])) body.push(cells(lines[idx++]));
      idx--;
      blocks.push(
        <div key={key} className="my-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-900">
              <tr>{header.map((h, c) => <th key={c} scope="col" className="px-3 py-2 font-semibold">{renderInline(h, `${key}-h${c}`)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {body.map((row, r) => (
                <tr key={r}>{header.map((_, c) => <td key={c} className="px-3 py-2 align-top">{renderInline(row[c] ?? '', `${key}-${r}-${c}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={key} className="my-4 border-slate-200" />);
      continue;
    }

    // Headings — level drives size, so a generated policy keeps its hierarchy.
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      // A heading that the model also wrapped in ** is shown once, not with stars.
      const text = heading[2].replace(/^\*\*(.*)\*\*$/, '$1');
      const styles: Record<number, string> = {
        1: 'mt-5 mb-2 text-lg font-bold text-slate-900',
        2: 'mt-5 mb-2 text-base font-bold text-slate-900',
        3: 'mt-4 mb-1.5 text-sm font-semibold text-slate-900',
      };
      const cls = styles[level] ?? 'mt-3 mb-1 text-sm font-semibold text-slate-800';
      const Tag = (`h${Math.min(level, 6)}`) as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={key} className={cls}>{renderInline(text, key)}</Tag>);
      continue;
    }

    // Blockquote
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      blocks.push(
        <blockquote key={key} className="my-2 border-l-2 border-slate-300 pl-3 text-slate-600 italic">
          {renderInline(quote[1], key)}
        </blockquote>,
      );
      continue;
    }

    // Anything else is a paragraph.
    blocks.push(
      <p key={key} className="my-2 leading-relaxed text-slate-700">{renderInline(line, key)}</p>,
    );
  }

  flushList();

  return <div className={`text-sm ${className}`}>{blocks}</div>;
}
