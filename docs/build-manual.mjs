#!/usr/bin/env node
/**
 * Converts USER_MANUAL.md into formats non-technical readers can open.
 *
 *   node docs/build-manual.mjs [outputDir]
 *
 * Produces:
 *   ComplianceCore-User-Manual.txt   plain text — Notepad, any editor, email
 *   ComplianceCore-User-Manual.rtf   rich text — Word and WordPad open it
 *                                    natively with no format warning
 *
 * RTF rather than .docx: a .docx is a zip of XML and would need a dependency,
 * whereas RTF is plain text this script can emit directly. Word treats it as a
 * first-class document — headings, bold and spacing all survive, and the file
 * stays diff-able in git.
 *
 * Regenerate this whenever the manual changes, so the distributed copies never
 * drift from the source.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SOURCE = fileURLToPath(new URL('./USER_MANUAL.md', import.meta.url));
const outDir = process.argv[2] ?? fileURLToPath(new URL('.', import.meta.url));

const md = await readFile(SOURCE, 'utf8');

/**
 * Rejoins wrapped prose into one line per paragraph.
 *
 * The source is hard-wrapped for readability in an editor, which means a
 * **bold span** can open on one line and close on the next. Parsing line by line
 * then leaves the literal asterisks in the output. Joining first also stops the
 * exported documents inheriting the source's arbitrary line breaks mid-sentence.
 * Structural lines — headings, lists, tables, rules — are never joined.
 */
function unwrapParagraphs(source) {
  const structural = (l) =>
    !l.trim() ||
    /^#{1,6}\s/.test(l) ||
    /^\s*[-*]\s/.test(l) ||
    /^\s*\d+[.)]\s/.test(l) ||
    /^>/.test(l) ||
    /^\s*\|/.test(l) ||
    /^\s*---+\s*$/.test(l) ||
    /^\s*```/.test(l);

  const out = [];
  let buffer = null;

  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    if (structural(line)) {
      if (buffer !== null) { out.push(buffer); buffer = null; }
      out.push(line);
    } else {
      buffer = buffer === null ? line.trim() : `${buffer} ${line.trim()}`;
    }
  }
  if (buffer !== null) out.push(buffer);
  return out;
}

const lines = unwrapParagraphs(md);

// ── Shared parsing ───────────────────────────────────────────────────────────
// Markdown tables are split into cells so each format can lay them out its own
// way; everything else maps one-to-one onto a block type.
const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableDivider = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
const cellsOf = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

/** Strips inline markdown that has no plain-text equivalent. */
const plainInline = (s) =>
  s.replace(/\*\*(.+?)\*\*/g, '$1')
   .replace(/\*(.+?)\*/g, '$1')
   .replace(/`(.+?)`/g, '$1')
   .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)');

// ── Plain text ───────────────────────────────────────────────────────────────
function toText() {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isTableRow(line)) {
      // Collect the table, then pad columns so it lines up in a monospaced view.
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        if (!isTableDivider(lines[i])) rows.push(cellsOf(lines[i]).map(plainInline));
        i++;
      }
      const widths = [];
      rows.forEach((r) => r.forEach((c, ci) => { widths[ci] = Math.max(widths[ci] ?? 0, c.length); }));
      rows.forEach((r, ri) => {
        out.push('  ' + r.map((c, ci) => c.padEnd(widths[ci])).join('   ').trimEnd());
        if (ri === 0) out.push('  ' + widths.map((w) => '-'.repeat(w)).join('   '));
      });
      out.push('');
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const text = plainInline(h[2]);
      out.push('');
      if (h[1].length === 1) {
        out.push('='.repeat(Math.min(text.length, 74)));
        out.push(text.toUpperCase());
        out.push('='.repeat(Math.min(text.length, 74)));
      } else if (h[1].length === 2) {
        out.push(text.toUpperCase());
        out.push('-'.repeat(Math.min(text.length, 74)));
      } else {
        out.push(text);
      }
      out.push('');
      i++; continue;
    }

    if (/^\s*---+\s*$/.test(line)) { out.push(''); out.push('-'.repeat(74)); out.push(''); i++; continue; }
    if (/^\s*[-*]\s+/.test(line))  { out.push('  * ' + plainInline(line.replace(/^\s*[-*]\s+/, ''))); i++; continue; }

    const num = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (num) { out.push(`  ${num[1]}. ` + plainInline(num[2])); i++; continue; }

    if (/^>\s?/.test(line)) { out.push('  | ' + plainInline(line.replace(/^>\s?/, ''))); i++; continue; }

    out.push(plainInline(line));
    i++;
  }

  return out.join('\r\n'); // CRLF so Notepad renders line breaks correctly
}

// ── RTF ──────────────────────────────────────────────────────────────────────
/** Escapes RTF control characters and encodes non-ASCII as \uN escapes. */
function rtfEscape(s) {
  let out = '';
  for (const ch of s.replace(/\\/g, '\\\\').replace(/([{}])/g, '\\$1')) {
    const code = ch.codePointAt(0);
    out += code > 127 ? `\\u${code}?` : ch;
  }
  return out;
}

/** Bold runs survive; other inline syntax is flattened. */
function rtfInline(s) {
  const parts = s.split(/(\*\*.+?\*\*)/g);
  return parts.map((p) => {
    const bold = /^\*\*(.+)\*\*$/.exec(p);
    if (bold) return `{\\b ${rtfEscape(plainInline(bold[1]))}}`;
    return rtfEscape(plainInline(p));
  }).join('');
}

function toRtf() {
  const body = [];
  let i = 0;

  const para = (text, opts = {}) => {
    const { size = 22, bold = false, space = 120, indent = 0, mono = false } = opts;
    body.push(
      `\\pard\\sa${space}\\li${indent}\\f${mono ? 1 : 0}\\fs${size}${bold ? '\\b' : ''} ${text}${bold ? '\\b0' : ''}\\par`,
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    if (isTableRow(line)) {
      // Rendered as indented "Header: value" pairs. Real RTF tables are brittle
      // across Word versions, and a long control table reads better this way.
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        if (!isTableDivider(lines[i])) rows.push(cellsOf(lines[i]));
        i++;
      }
      const header = rows.shift() ?? [];
      rows.forEach((r) => {
        para(rtfInline(r[0] ?? ''), { bold: true, space: 20, indent: 280 });
        r.slice(1).forEach((c, ci) => {
          if (!c) return;
          const label = header[ci + 1] ? `${plainInline(header[ci + 1])}: ` : '';
          para(rtfEscape(label) + rtfInline(c), { size: 20, space: 40, indent: 560 });
        });
      });
      body.push('\\pard\\sa120\\par');
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const sizes = { 1: 40, 2: 30, 3: 25 };
      para(rtfInline(h[2]), { size: sizes[h[1].length] ?? 23, bold: true, space: 160 });
      i++; continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      body.push('\\pard\\brdrb\\brdrs\\brdrw10\\brsp20\\sa180\\par');
      i++; continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      para('\\u8226?  ' + rtfInline(line.replace(/^\s*[-*]\s+/, '')), { space: 40, indent: 280 });
      i++; continue;
    }
    const num = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (num) {
      para(`${num[1]}.  ` + rtfInline(num[2]), { space: 40, indent: 280 });
      i++; continue;
    }
    if (/^>\s?/.test(line)) {
      para(rtfInline(line.replace(/^>\s?/, '')), { indent: 280, space: 120 });
      i++; continue;
    }
    if (!line.trim()) { i++; continue; }

    para(rtfInline(line));
    i++;
  }

  return [
    '{\\rtf1\\ansi\\ansicpg1252\\deff0',
    '{\\fonttbl{\\f0\\froman Georgia;}{\\f1\\fmodern Consolas;}}',
    '\\margl1134\\margr1134\\margt1134\\margb1134',
    body.join('\n'),
    '}',
  ].join('\n');
}

// ── Write ────────────────────────────────────────────────────────────────────
const txtPath = path.join(outDir, 'ComplianceCore-User-Manual.txt');
const rtfPath = path.join(outDir, 'ComplianceCore-User-Manual.rtf');

// UTF-8 BOM on the .txt: without it Notepad may fall back to the system code
// page and render every em dash and curly quote as mojibake. The RTF needs no
// BOM — rtfEscape has already reduced it to pure ASCII with \uN escapes.
await writeFile(txtPath, '﻿' + toText(), 'utf8');
await writeFile(rtfPath, toRtf(), 'ascii');

console.log(`Wrote:\n  ${txtPath}\n  ${rtfPath}`);
