import PDFDocument from 'pdfkit';
import { SUPPORT_EMAIL } from '../../config/contact';
import type { Invoice } from './billing.types';

/** Flow-based invoice: measured text, continuation rows and repeatable page furniture. */
export function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true,
      info: { Title: `Invoice ${invoice.number}`, Author: 'Orion Soft Limited' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const left = 42, right = doc.page.width - 42, width = right - left, bottom = 742;
    const ink = '#172554', muted = '#64748B', accent = '#4F46E5', line = '#E2E8F0';
    const currency = (invoice.currency || 'NGN').toUpperCase();
    const demo = invoice.metadata?.demo === true || invoice.metadata?.notPayable === true;
    const date = (value: string) => new Date(value).toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
    const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const text = (value: string, x: number, y: number, w: number, size = 10, bold = false, color = ink, align: 'left'|'right' = 'left') => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
      const h = doc.heightOfString(value, { width: w, lineGap: 3 });
      doc.text(value, x, y, { width: w, lineGap: 3, align });
      return h;
    };
    const number = (value: string, x: number, y: number, w: number, size = 10, bold = false, color = ink) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
      doc.fontSize(size);
      while (size > 5 && doc.widthOfString(value) > w) { size -= 0.25; doc.fontSize(size); }
      return text(value, x, y, w, size, bold, color, 'right');
    };
    let y = 0;
    const rule = (at: number) => doc.moveTo(left, at).lineTo(right, at).lineWidth(0.6).stroke(line);
    const newPage = () => {
      doc.addPage();
      text('COMPLIANCECORE / ORION SOFT LIMITED', left, 36, 285, 9, true, accent);
      text(invoice.number, right - 210, 36, 210, 9, true, ink, 'right');
      rule(59); y = 76;
    };
    const ensure = (height: number) => { if (y + height > bottom) newPage(); };
    const tableHeader = () => {
      doc.rect(left, y, width, 28).fill('#EEF2FF');
      text('SERVICE / DESCRIPTION', left + 10, y + 9, 238, 8, true, muted);
      text('QTY', left + 254, y + 9, 36, 8, true, muted, 'right');
      text('UNIT PRICE', left + 300, y + 9, 92, 8, true, muted, 'right');
      text('AMOUNT', right - 103, y + 9, 93, 8, true, muted, 'right');
      y += 28;
    };

    doc.rect(0, 0, doc.page.width, 138).fill(ink);
    doc.rect(left, 35, 4, 67).fill('#818CF8');
    text('ComplianceCore', left + 16, 35, 275, 25, true, '#FFFFFF');
    text('ORION SOFT LIMITED', left + 16, 73, 265, 10, true, '#C7D2FE');
    text(SUPPORT_EMAIL, left + 16, 94, 280, 9, false, '#E2E8F0');
    text('INVOICE', right - 155, 39, 155, 27, true, '#FFFFFF', 'right');
    const status = invoice.status === 'open' && invoice.amountPaid > 0 ? 'PARTIALLY PAID' : invoice.status.toUpperCase();
    text(demo ? 'DEMONSTRATION' : status, right - 160, 82, 160, 10, true, '#C7D2FE', 'right');

    const recipientHeight = text('BILL TO', left, 164, 260, 8, true, muted);
    const nameHeight = text((invoice.tenantName || 'Account holder').replace(/[\u2013\u2014]/g, '-'), left, 164 + recipientHeight + 9, 254, 15, true);
    text(demo ? 'Presentation workspace - fictional examples' : 'ComplianceCore subscription account', left, 164 + recipientHeight + nameHeight + 18, 254, 9, false, muted);
    let metaY = 164;
    for (const [label, value] of [['INVOICE NUMBER', invoice.number], ['ISSUED', date(invoice.createdAt)], ['DUE DATE', date(invoice.dueDate)]]) {
      text(label, right - 218, metaY, 84, 8, true, muted);
      metaY += Math.max(19, text(value, right - 129, metaY - 1, 129, 9, true, ink, 'right') + 7);
    }
    y = Math.max(metaY + 14, 164 + recipientHeight + nameHeight + 49);
    rule(y); y += 16;
    y += text(`SERVICE PERIOD  ${date(invoice.billingPeriodStart)} - ${date(invoice.billingPeriodEnd)}`, left, y, width, 9, false, muted) + 10;
    if (demo) {
      doc.rect(left, y, width, 35).fill('#FFFBEB');
      text('DEMONSTRATION ONLY - NOT A PAYMENT REQUEST', left + 10, y + 7, width - 20, 9, true, '#92400E');
      text('Illustrative pricing for discussion; no payment is due on this sample.', left + 10, y + 21, width - 20, 8, false, '#92400E');
      y += 48;
    }
    text(`All amounts in ${currency}`, left, y, width, 8, false, muted, 'right'); y += 19;
    ensure(60); tableHeader();
    for (const item of invoice.lineItems) {
      // Chunk long descriptions over continuation rows; figures appear once.
      const words = (item.description || 'Service').split(/\s+/).flatMap(word => word.match(/.{1,70}/g) || ['']);
      let pending = '', first = true;
      const row = (description: string) => {
        doc.font('Helvetica').fontSize(9);
        const height = Math.max(38, doc.heightOfString(description, { width: 238, lineGap: 3 }) + 22);
        if (y + height > bottom) { newPage(); tableHeader(); }
        text(description, left + 10, y + 11, 238, 9);
        if (first) {
          number(String(item.quantity), left + 254, y + 11, 36, 9);
          number(money(item.unitAmount), left + 300, y + 11, 92, 9);
          number(money(item.amount), right - 103, y + 11, 93, 9, true);
          first = false;
        }
        y += height; rule(y);
      };
      for (const word of words) {
        doc.font('Helvetica').fontSize(9);
        const candidate = pending ? `${pending} ${word}` : word;
        if (pending && doc.heightOfString(candidate, { width: 238, lineGap: 3 }) > 240) { row(pending); pending = word; }
        else pending = candidate;
      }
      if (pending) row(pending);
    }
    y += 22; ensure(190);
    const totalsX = right - 284;
    const total = (label: string, amount: number, bold = false) => {
      text(label, totalsX + 12, y + 10, 127, bold ? 11 : 9, bold, bold ? ink : muted);
      number(money(amount), totalsX + 145, y + 9, 127, bold ? 14 : 11, true, bold ? accent : ink);
      y += bold ? 48 : 32;
    };
    total(`Invoice total (${currency})`, invoice.amountDue);
    total('Amount received', invoice.amountPaid);
    doc.rect(totalsX, y, 284, 48).fill('#EEF2FF');
    total(demo ? 'Illustrative balance' : invoice.status === 'void' ? 'Amount payable' : 'Balance due', demo ? Math.max(0, invoice.amountDue - invoice.amountPaid) : invoice.status === 'void' ? 0 : Math.max(0, invoice.amountDue - invoice.amountPaid), true);
    y += 22;
    const note = demo ? 'Sample invoice. Onboarding is charged once; subsequent renewals cover the subscription only. An agreed commercial offer is required before purchase.'
      : invoice.status === 'draft' ? 'Draft invoice for review. Contact Orion Soft Limited to confirm the final invoice and payment instructions.'
      : invoice.status === 'void' ? 'This invoice has been voided. No payment is required against this document.'
      : invoice.status === 'paid' ? 'Payment recorded. Thank you for choosing ComplianceCore.'
      : 'Please quote the invoice number in payment correspondence. Use the payment instructions provided through your verified billing account.';
    y += text(note, left, y, width, 9, false, muted);
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i); rule(775);
      text('Orion Soft Limited | ComplianceCore', left, 787, 285, 8, false, muted);
      text(`Page ${i + 1} of ${range.count} | ${currency}`, right - 160, 787, 160, 8, false, muted, 'right');
    }
    doc.end();
  });
}
