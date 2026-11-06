import { reconcileInvoices, type Payment } from '@lp-labs/invoice-reconciliation';
const payments: Payment[] = [{ id: 'p', currency: 'USD', amountMinor: 10n, invoiceId: 'i' }];
const due: bigint = reconcileInvoices([{ id: 'i', currency: 'USD', amountMinor: 10n }], payments)
  .invoices[0]!.remainingMinor;
void due;
