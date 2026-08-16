// Raw ESC/POS command builder — the actual byte-level protocol nearly
// every thermal receipt printer (Bluetooth, WiFi/LAN, or USB) speaks
// natively, regardless of brand. Building this ourselves means both the
// network (TCP) and Bluetooth print paths can share one real
// implementation instead of two different "kind of works" ones.
//
// Deliberately plain-ASCII-safe: most thermal printers use a single-byte
// character set and don't render ₹ (U+20B9) at all — silently drops to
// blank or garbage on many models — so amounts print as "Rs." here
// instead. This is a printer hardware limitation, not a shortcut.

const ESC = 0x1b;
const GS = 0x1d;

export interface ReceiptLine {
  text: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  size?: 'normal' | 'double';
}
export interface ReceiptItem {
  name: string;
  qty: number;
  unitCost: number;
}
export interface ReceiptData {
  shopName: string;
  address: string;
  phone: string;
  gstNumber?: string;
  docType: string; // "INVOICE" | "ESTIMATE"
  docNumber: string;
  date: string;
  customerName: string;
  vehicleLabel?: string;
  plateNumber?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  paymentModeSummary?: string;
  footerText?: string;
  paperWidth?: 58 | 80; // mm — 58mm prints 32 chars/line, 80mm prints 48
  printerIp?: string; // if set, enables the "Network Print" button
}

class EscPosBuilder {
  private bytes: number[] = [];
  private lineWidth: number;

  constructor(lineWidth = 32) {
    this.lineWidth = lineWidth;
  }

  init() {
    this.bytes.push(ESC, 0x40); // ESC @ — reset printer state
    return this;
  }

  align(mode: 'left' | 'center' | 'right') {
    const code = mode === 'center' ? 1 : mode === 'right' ? 2 : 0;
    this.bytes.push(ESC, 0x61, code);
    return this;
  }

  bold(on: boolean) {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleSize(on: boolean) {
    this.bytes.push(GS, 0x21, on ? 0x11 : 0x00); // double width+height, or reset
    return this;
  }

  text(str: string) {
    // Strip anything outside printable ASCII (thermal printers' default
    // code page can't render most Unicode, and a raw multi-byte char
    // would corrupt the byte stream) and swap the rupee sign for "Rs."
    const ascii = str.replace(/\u20b9/g, 'Rs.').replace(/[^\x20-\x7e\n]/g, '');
    for (const ch of ascii) {
      this.bytes.push(ch.charCodeAt(0));
    }
    return this;
  }

  newline(count = 1) {
    for (let i = 0; i < count; i++) this.bytes.push(0x0a);
    return this;
  }

  divider(char = '-', width?: number) {
    this.text(char.repeat(width ?? this.lineWidth));
    this.newline();
    return this;
  }

  // Left-aligned label + right-aligned value on one line, padded to fit
  // the printer's character width (32 chars for 58mm paper, 48 for
  // 80mm, at the printer's default font).
  row(left: string, right: string, width?: number) {
    const w = width ?? this.lineWidth;
    const space = Math.max(1, w - left.length - right.length);
    this.text(left + ' '.repeat(space) + right);
    this.newline();
    return this;
  }

  cutPaper() {
    this.newline(3);
    this.bytes.push(GS, 0x56, 0x00); // full cut
    return this;
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

export function buildReceiptEscPos(data: ReceiptData): Uint8Array {
  const charWidth = data.paperWidth === 80 ? 48 : 32;
  const b = new EscPosBuilder(charWidth);
  b.init();

  b.align('center').bold(true).doubleSize(true).text(data.shopName).newline().doubleSize(false).bold(false);
  if (data.address) b.text(data.address).newline();
  if (data.phone) b.text(`Ph: ${data.phone}`).newline();
  if (data.gstNumber) b.text(`GSTIN: ${data.gstNumber}`).newline();
  b.newline();

  b.align('left').bold(true).text(`${data.docType} ${data.docNumber}`).newline().bold(false);
  b.text(`Date: ${data.date}`).newline();
  b.text(`Customer: ${data.customerName}`).newline();
  if (data.vehicleLabel) b.text(`Vehicle: ${data.vehicleLabel} (${data.plateNumber ?? ''})`).newline();
  b.newline();
  b.divider('=');

  for (const item of data.items) {
    const amount = item.qty * item.unitCost;
    b.text(item.name.slice(0, charWidth)).newline();
    b.row(`  ${item.qty} x Rs.${item.unitCost.toLocaleString('en-IN')}`, `Rs.${amount.toLocaleString('en-IN')}`);
  }
  b.divider('-');

  b.row('Subtotal', `Rs.${data.subtotal.toLocaleString('en-IN')}`);
  if (data.discount) b.row('Discount', `-Rs.${data.discount.toLocaleString('en-IN')}`);
  if (data.tax) b.row('Tax', `Rs.${data.tax.toLocaleString('en-IN')}`);
  b.bold(true).row('TOTAL', `Rs.${data.total.toLocaleString('en-IN')}`).bold(false);
  if (data.amountPaid !== undefined) b.row('Paid', `Rs.${data.amountPaid.toLocaleString('en-IN')}`);
  if (data.paymentModeSummary) b.text(`Payment: ${data.paymentModeSummary}`).newline();
  if (data.balanceDue) b.bold(true).row('Balance Due', `Rs.${data.balanceDue.toLocaleString('en-IN')}`).bold(false);

  b.newline();
  b.align('center').text(data.footerText || 'Thank you for your business!').newline();
  b.cutPaper();

  return b.toBytes();
}
