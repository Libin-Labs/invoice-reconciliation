export interface Invoice {
  id: string;
  currency: string;
  amountMinor: bigint;
}

export interface Payment {
  id: string;
  currency: string;
  amountMinor: bigint;
  invoiceId?: string;
}

export type MatchReason =
  | 'reference'
  | 'unique-exact-amount'
  | 'unknown-invoice-reference'
  | 'currency-mismatch'
  | 'already-settled'
  | 'no-exact-balance'
  | 'ambiguous-exact-balance';

export interface PaymentDecision {
  paymentId: string;
  invoiceId?: string;
  allocatedMinor: bigint;
  unappliedMinor: bigint;
  reason: MatchReason;
}

export interface InvoiceBalance {
  invoiceId: string;
  currency: string;
  amountMinor: bigint;
  paidMinor: bigint;
  remainingMinor: bigint;
}

export interface ReconciliationResult {
  invoices: readonly InvoiceBalance[];
  payments: readonly PaymentDecision[];
}

function validateAmount(amount: bigint, name: string): void {
  if (typeof amount !== 'bigint' || amount < 0n) {
    throw new TypeError(`${name} must be a non-negative bigint minor-unit amount.`);
  }
  if (amount.toString().length > 1000) throw new RangeError(`${name} exceeds 1000 digits.`);
}

function validateId(id: string, name: string): void {
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) {
    throw new TypeError(`${name} must be a nonempty string up to 128 characters.`);
  }
}

function validateCurrency(currency: string): void {
  if (typeof currency !== 'string' || !/^[A-Z][A-Z0-9]{2,11}$/.test(currency)) {
    throw new TypeError('Currency must be an uppercase identifier of 3 to 12 characters.');
  }
}

export function reconcileInvoices(
  invoicesInput: readonly Invoice[],
  paymentsInput: readonly Payment[],
): ReconciliationResult {
  if (!Array.isArray(invoicesInput) || invoicesInput.length > 100_000) {
    throw new RangeError('Invoices must be an array containing at most 100000 entries.');
  }
  if (!Array.isArray(paymentsInput) || paymentsInput.length > 100_000) {
    throw new RangeError('Payments must be an array containing at most 100000 entries.');
  }
  const invoices = new Map<string, InvoiceBalance>();
  const balances = new Map<string, Set<string>>();
  const balanceKey = (currency: string, amount: bigint) => `${currency}\u0000${amount}`;
  const indexBalance = (invoice: InvoiceBalance) => {
    if (invoice.remainingMinor === 0n) return;
    const key = balanceKey(invoice.currency, invoice.remainingMinor);
    const matches = balances.get(key) ?? new Set<string>();
    matches.add(invoice.invoiceId);
    balances.set(key, matches);
  };
  const invoiceOrder: string[] = [];
  const invoiceRows = invoicesInput as readonly Invoice[];
  for (const invoice of invoiceRows) {
    validateId(invoice.id, 'Invoice ID');
    validateCurrency(invoice.currency);
    validateAmount(invoice.amountMinor, `Invoice ${invoice.id}`);
    if (invoices.has(invoice.id)) throw new TypeError(`Duplicate invoice ID: ${invoice.id}`);
    invoiceOrder.push(invoice.id);
    invoices.set(invoice.id, {
      invoiceId: invoice.id,
      currency: invoice.currency,
      amountMinor: invoice.amountMinor,
      paidMinor: 0n,
      remainingMinor: invoice.amountMinor,
    });
    indexBalance(invoices.get(invoice.id)!);
  }

  const payments = paymentsInput as readonly Payment[];
  const paymentIds = new Set<string>();
  const decisions = payments.map((payment): PaymentDecision => {
    validateId(payment.id, 'Payment ID');
    validateCurrency(payment.currency);
    validateAmount(payment.amountMinor, `Payment ${payment.id}`);
    if (payment.amountMinor === 0n) throw new RangeError('Payments must be greater than zero.');
    if (paymentIds.has(payment.id)) throw new TypeError(`Duplicate payment ID: ${payment.id}`);
    paymentIds.add(payment.id);

    let target: InvoiceBalance | undefined;
    let reason: MatchReason;
    if (payment.invoiceId !== undefined) {
      validateId(payment.invoiceId, 'Invoice reference');
      target = invoices.get(payment.invoiceId);
      if (!target) reason = 'unknown-invoice-reference';
      else if (target.currency !== payment.currency) {
        reason = 'currency-mismatch';
        target = undefined;
      } else if (target.remainingMinor === 0n) {
        reason = 'already-settled';
        target = undefined;
      } else {
        reason = 'reference';
      }
    } else {
      const candidates = balances.get(balanceKey(payment.currency, payment.amountMinor));
      if (candidates?.size === 1) {
        const invoiceId = candidates.values().next().value;
        if (invoiceId === undefined) throw new Error('Exact-balance index is inconsistent.');
        target = invoices.get(invoiceId);
        if (!target) throw new Error('Exact-balance invoice is missing.');
        reason = 'unique-exact-amount';
      } else {
        reason = (candidates?.size ?? 0) > 1 ? 'ambiguous-exact-balance' : 'no-exact-balance';
      }
    }

    if (!target) {
      return Object.freeze({
        paymentId: payment.id,
        allocatedMinor: 0n,
        unappliedMinor: payment.amountMinor,
        reason,
      });
    }
    const allocatedMinor =
      payment.amountMinor < target.remainingMinor ? payment.amountMinor : target.remainingMinor;
    const previousKey = balanceKey(target.currency, target.remainingMinor);
    const previousMatches = balances.get(previousKey);
    previousMatches?.delete(target.invoiceId);
    if (previousMatches?.size === 0) balances.delete(previousKey);
    target.paidMinor += allocatedMinor;
    target.remainingMinor -= allocatedMinor;
    indexBalance(target);
    return Object.freeze({
      paymentId: payment.id,
      invoiceId: target.invoiceId,
      allocatedMinor,
      unappliedMinor: payment.amountMinor - allocatedMinor,
      reason,
    });
  });

  return Object.freeze({
    invoices: Object.freeze(invoiceOrder.map((id) => Object.freeze(invoices.get(id)!))),
    payments: Object.freeze(decisions),
  });
}
