import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileInvoices } from '../dist/esm/index.js';

const invoice = (id, amountMinor, currency = 'USD') => ({ id, amountMinor, currency });
const payment = (id, amountMinor, extra = {}) => ({ id, amountMinor, currency: 'USD', ...extra });

test('matches a unique exact outstanding amount', () => {
  const result = reconcileInvoices([invoice('i1', 500n)], [payment('p1', 500n)]);
  assert.equal(result.payments[0].reason, 'unique-exact-amount');
  assert.equal(result.payments[0].invoiceId, 'i1');
  assert.equal(result.invoices[0].remainingMinor, 0n);
});

test('does not guess between equal invoice balances', () => {
  const result = reconcileInvoices([invoice('a', 500n), invoice('b', 500n)], [payment('p', 500n)]);
  assert.equal(result.payments[0].reason, 'ambiguous-exact-balance');
  assert.equal(result.payments[0].unappliedMinor, 500n);
});

test('applies explicitly referenced partial payments exactly', () => {
  const result = reconcileInvoices([invoice('i', 900n)], [payment('p', 350n, { invoiceId: 'i' })]);
  assert.equal(result.payments[0].reason, 'reference');
  assert.equal(result.payments[0].allocatedMinor, 350n);
  assert.equal(result.invoices[0].remainingMinor, 550n);
});

test('reports referenced overpayment as an unapplied remainder', () => {
  const result = reconcileInvoices([invoice('i', 100n)], [payment('p', 150n, { invoiceId: 'i' })]);
  assert.equal(result.payments[0].allocatedMinor, 100n);
  assert.equal(result.payments[0].unappliedMinor, 50n);
});

test('leaves unreferenced partial amounts unmatched instead of guessing', () => {
  const result = reconcileInvoices([invoice('i', 500n)], [payment('p', 100n)]);
  assert.equal(result.payments[0].reason, 'no-exact-balance');
  assert.equal(result.invoices[0].paidMinor, 0n);
});

test('explains unknown invoice references and currency mismatches', () => {
  const unknown = reconcileInvoices(
    [invoice('i', 100n)],
    [payment('p', 100n, { invoiceId: 'missing' })],
  );
  assert.equal(unknown.payments[0].reason, 'unknown-invoice-reference');
  const wrongCurrency = reconcileInvoices(
    [invoice('i', 100n, 'EUR')],
    [payment('p', 100n, { invoiceId: 'i' })],
  );
  assert.equal(wrongCurrency.payments[0].unappliedMinor, 100n);
  assert.equal(wrongCurrency.payments[0].reason, 'currency-mismatch');
});

test('processes payments in supplied order and prevents duplicate allocation', () => {
  const result = reconcileInvoices(
    [invoice('i', 100n)],
    [payment('first', 60n, { invoiceId: 'i' }), payment('second', 60n, { invoiceId: 'i' })],
  );
  assert.deepEqual(
    result.payments.map((part) => part.allocatedMinor),
    [60n, 40n],
  );
  assert.equal(result.payments[1].unappliedMinor, 20n);
});

test('updates exact-balance candidates after each explicit allocation', () => {
  const result = reconcileInvoices(
    [invoice('a', 500n), invoice('b', 500n)],
    [payment('partial', 100n, { invoiceId: 'a' }), payment('exact', 400n)],
  );
  assert.equal(result.payments[1].reason, 'unique-exact-amount');
  assert.equal(result.payments[1].invoiceId, 'a');
});

test('reports already-settled invoices for later references', () => {
  const result = reconcileInvoices(
    [invoice('i', 10n)],
    [payment('a', 10n, { invoiceId: 'i' }), payment('b', 1n, { invoiceId: 'i' })],
  );
  assert.equal(result.payments[1].reason, 'already-settled');
});

test('rejects duplicate identifiers, zero payments, and negative amounts', () => {
  assert.throws(
    () => reconcileInvoices([invoice('i', 1n), invoice('i', 2n)], []),
    /Duplicate invoice/,
  );
  assert.throws(() => reconcileInvoices([], [payment('p', 0n)]), /greater than zero/);
  assert.throws(() => reconcileInvoices([invoice('i', -1n)], []), TypeError);
});

test('returns immutable decision and balance records', () => {
  const result = reconcileInvoices([invoice('i', 10n)], [payment('p', 10n)]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.invoices[0]));
  assert.ok(Object.isFrozen(result.payments[0]));
});
