import {
  reconcileInvoices,
  type Invoice,
  type PaymentDecision,
} from '@lp-labs/invoice-reconciliation';
const invoices: Invoice[] = [{ id: 'i', currency: 'USD', amountMinor: 1000n }];
const decisions: readonly PaymentDecision[] = reconcileInvoices(invoices, []).payments;
void decisions;
