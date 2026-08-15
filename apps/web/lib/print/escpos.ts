// Shared ESC/POS command builder + receipt formatter.
//
// This file only turns receipt data into the raw bytes a thermal
// printer understands natively (the same command language RawBT/the
// printer's own app translates an image into — except here we send
// real text+format commands directly, so print quality is sharper and
// noticeably faster than image-based printing).
//
// This file has NO knowledge of *how* the bytes reach the printer.
// See lib/print/bluetooth.ts (Bluetooth) and app/api/print/network/route.ts
// (WiFi/LAN) for the two transports that use this.

const ESC = 0x1b;
const GS = 0x1d;

export class EscPosBuilder {
  private bytes: number[] = [];

  init() {
    this.bytes.push(ESC, 0x40); // ESC @ — reset printer state
    return this;
  }

  align(pos: 'left' | 'center' | 'right') {
    const n = pos === 'left' ? 0 : pos === 'center' ? 1 : 2;
    this.bytes.push(ESC, 0x61, n);
    return this;
  }

  bold(on: boolean) {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleSize(on: boolean) {
    this.bytes.push(GS, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  text(str: string) {
    this.bytes.push(...Array.from(new TextEncoder().encode(str)));
    return this;
  }

  line(str = '') {
    return this.text(str).feed(1);
  }

  feed(n = 1) {
    this.bytes.push(ESC, 0x64, n);
    return this;
  }

  divider(width: number, char = '-') {
    return this.line(char.repeat(width));
  }

  /** Left-aligned label + right-aligned value on one line, padded to `width` chars. */
  twoCol(left: string, right: string, width: number) {
    const space = Math.max(1, width - left.length - right.length);
    return this.line(left + ' '.repeat(space) + right);
  }

  cut() {
    this.bytes.push(GS, 0x56, 0x00); // full cut
    return this;
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

export interface ReceiptData {
  org: {
    name: string;
    address?: string | null;
    contact_phone?: string | null;
    gst_number?: string | null;
    footer_text?: string | null;
  };
  invoice: {
    invoice_number: string;
    date: string;
    subtotal: number;
    discount: number;
    tax: number;
    taxType: string;
    total: number;
    amountPaid: number;
    balanceDue: number;
    paymentModeSummary?: string;
  };
  job?: { job_number: string } | null;
  customer?: { first_name: string; last_name: string } | null;
  vehicle?: { make: string; model: string; plate_number: string } | null;
  items: Array<{ name: string; qty: number; unitCost: number; suffix?: string }>;
}

/**
 * Builds the same content as the existing thermal HTML view
 * (app/print/invoices/[id]/page.tsx, isThermal branch) as raw ESC/POS
 * bytes. charsPerLine: 32 for common 58mm printers, 48 for 80mm.
 */
export function buildInvoiceReceipt(data: ReceiptData, charsPerLine: 32 | 48 = 32): Uint8Array {
  const b = new EscPosBuilder().init();

  b.align('center');
  b.bold(true).doubleSize(true).line(data.org.name).doubleSize(false).bold(false);
  if (data.org.address) b.line(data.org.address);
  if (data.org.contact_phone) b.line(`Ph: ${data.org.contact_phone}`);
  if (data.org.gst_number) b.line(`GSTIN: ${data.org.gst_number}`);
  b.divider(charsPerLine);
  b.bold(true).line('TAX INVOICE').bold(false);
  b.divider(charsPerLine);

  b.align('left');
  b.line(`No : ${data.invoice.invoice_number}`);
  b.line(`Date: ${data.invoice.date}`);
  if (data.job) b.line(`Job : ${data.job.job_number}`);
  if (data.customer) b.line(`Cust: ${data.customer.first_name} ${data.customer.last_name}`);
  if (data.vehicle) b.line(`Veh : ${data.vehicle.make} ${data.vehicle.model} (${data.vehicle.plate_number})`);
  b.divider(charsPerLine);

  for (const item of data.items) {
    const label = (item.suffix ? `${item.name} ${item.suffix}` : item.name).slice(0, charsPerLine - 8);
    b.twoCol(label, `Rs.${(item.qty * item.unitCost).toFixed(2)}`, charsPerLine);
  }
  b.divider(charsPerLine);

  b.twoCol('Subtotal', `Rs.${data.invoice.subtotal.toFixed(2)}`, charsPerLine);
  if (data.invoice.discount > 0) {
    b.twoCol('Discount', `-Rs.${data.invoice.discount.toFixed(2)}`, charsPerLine);
  }
  b.twoCol(`GST (${data.invoice.taxType === 'igst' ? 'IGST' : 'CGST+SGST'})`, `Rs.${data.invoice.tax.toFixed(2)}`, charsPerLine);

  b.bold(true);
  b.twoCol('TOTAL', `Rs.${data.invoice.total.toFixed(2)}`, charsPerLine);
  b.bold(false);

  if (data.invoice.amountPaid > 0) b.twoCol('Paid', `Rs.${data.invoice.amountPaid.toFixed(2)}`, charsPerLine);
  if (data.invoice.paymentModeSummary) b.line(`Mode: ${data.invoice.paymentModeSummary}`);
  if (data.invoice.balanceDue > 0) {
    b.bold(true);
    b.twoCol('BALANCE DUE', `Rs.${data.invoice.balanceDue.toFixed(2)}`, charsPerLine);
    b.bold(false);
  }

  b.align('center');
  b.divider(charsPerLine);
  b.line(data.org.footer_text || 'Thank you for your business!');
  b.line('Powered by Smart Service Center OS');
  b.feed(3);
  b.cut();

  return b.toBytes();
}
