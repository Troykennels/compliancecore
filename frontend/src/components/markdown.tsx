import React from 'react';

/**
 * Minimal markdown renderer for AI-generated documents.
 *
 * Deliberately hand-rolled rather than a library plus `dangerouslySetInnerHTML`:
 * this text comes back from a language model, so treating it as HTML would let a
 * prompt-injected response inject script into the page. Everything here is built
 * as React elements, so the content can only ever render as text.
 *
 * Covers what the AI prompts actually ask for — headings, bold, bullet and
 * numbered lists, blockquotes and horizontal rules. Anything unrecognised falls
 * through as a plain paragraph rather than showing raw syntax to the user.
 */

/** Splits a line into text and **bold** runs. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Handles **bold** and __bold__; the lazy group stops at the first closer.
  const pattern = /(\*\*|__)(.+?)\1/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(
      <strong key={`${keyPrefix}-b${i++}`} className="font-semibold text-slate-900">
        {match[2]}
      </strong>,
    );
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className = '' }: MarkdownProps): JSX.Element {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];

  // Consecutive list items are gathered so they render as one <ul>/<ol> rather
  // than a series of single-item lists, which browsers space out awkwardly.
  let listBuffer: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!listBuffer) return;
    const { ordered, items } = listBuffer;
    const key = `list-${blocks.length}`;
    const rendered = items.map((item, i) => (
      <li key={`${key}-${i}`} className="ml-1 pl-1">{renderInline(item, `${key}-${i}`)}</li>
    ));
    blocks.push(
      ordered
        ? <ol key={key} className="my-2 list-decimal space-y-1 pl-5 text-slate-700">{rendered}</ol>
        : <ul key={key} className="my-2 list-disc space-y-1 pl-5 text-slate-700">{rendered}</ul>,
    );
    listBuffer = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const key = `md-${idx}`;

    if (!line.trim()) { flushList(); return; }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushList();
      blocks.push(<hr key={key} className="my-4 border-slate-200" />);
      return;
    }

    // Headings — level drives size, so a generated policy keeps its hierarchy.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const text = heading[2];
      const styles: Record<number, string> = {
        1: 'mt-5 mb-2 text-lg font-bold text-slate-900',
        2: 'mt-5 mb-2 text-base font-bold text-slate-900',
        3: 'mt-4 mb-1.5 text-sm font-semibold text-slate-900',
      };
      const cls = styles[level] ?? 'mt-3 mb-1 text-sm font-semibold text-slate-800';
      const Tag = (`h${Math.min(level, 6)}`) as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={key} className={cls}>{renderInline(text, key)}</Tag>);
      return;
    }

    // Blockquote
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushList();
      blocks.push(
        <blockquote key={key} className="my-2 border-l-2 border-slate-300 pl-3 text-slate-600 italic">
          {renderInline(quote[1], key)}
        </blockquote>,
      );
      return;
    }

    // Bullet list item
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      if (listBuffer?.ordered) flushList(); // switching ordered -> bullet
      if (!listBuffer) listBuffer = { ordered: false, items: [] };
      listBuffer.items.push(bullet[1]);
      return;
    }

    // Numbered list item
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (listBuffer && !listBuffer.ordered) flushList(); // switching bullet -> ordered
      if (!listBuffer) listBuffer = { ordered: true, items: [] };
      listBuffer.items.push(numbered[1]);
      return;
    }

    // Anything else is a paragraph.
    flushList();
    blocks.push(
      <p key={key} className="my-2 leading-relaxed text-slate-700">{renderInline(line, key)}</p>,
    );
  });

  flushList();

  return <div className={`text-sm ${className}`}>{blocks}</div>;
}
