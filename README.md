# @lp-labs/invoice-reconciliation

Reconcile invoice balances and payments using exact integer minor units and explainable decisions.
Referenced payments can be allocated partially; unreferenced payments match only one unique,
exactly equal open balance. No fuzzy score, amount tolerance, implicit currency conversion, or
runtime/peer dependency is used. Ships ESM, CommonJS and TypeScript declarations.

## Install

```sh
npm install @lp-labs/invoice-reconciliation
```

Requires Node.js 18+ or an ESM-aware bundler with `bigint` support. CommonJS:
`const { reconcileInvoices } = require('@lp-labs/invoice-reconciliation')`.

## Quickstart

```js
import { reconcileInvoices } from '@lp-labs/invoice-reconciliation';

const result = reconcileInvoices(
  [{ id: 'INV-1', currency: 'USD', amountMinor: 12500n }],
  [{ id: 'PAY-1', currency: 'USD', amountMinor: 5000n, invoiceId: 'INV-1' }],
);
console.log(result.invoices[0].remainingMinor); // 7500n
console.log(result.payments[0]); // Explicit reference decision and allocated/unapplied amounts
```

## Public API

Runtime export: `reconcileInvoices(invoices, payments): ReconciliationResult`.

Type exports: `Invoice`, `Payment`, `MatchReason`, `PaymentDecision`, `InvoiceBalance`,
`ReconciliationResult`.

Invoices require unique IDs, currency and a non-negative `amountMinor: bigint`. Payments require
unique IDs, currency and a positive bigint amount; `invoiceId` is optional. Currency identifiers
must match exactly and use uppercase 3–12 character labels. Inputs are processed in supplied
order. A payment with an invoice reference allocates up to the open balance, reporting any excess
as unapplied. A reference with an unknown invoice or currency mismatch is not guessed.

Without a reference, a payment is allocated only when exactly one invoice in that currency has an
open balance equal to the full payment. No partial amount matching occurs without an explicit
reference. Decisions report `reason`, allocated amount, unapplied amount, and matched invoice when
applicable. Reasons are `reference`, `unique-exact-amount`, `unknown-invoice-reference`,
`currency-mismatch`, `already-settled`, `no-exact-balance`, and `ambiguous-exact-balance`.

## Customization and limits

Provide normalized, trusted invoice/payment records and attach an invoice reference when partial
payment allocation is intended. Apply your own credit notes, write-offs, fees, payment reversal,
FX, duplicate-payment policy and persistence/transaction controls before or after reconciliation.
The function is an in-memory arithmetic pass, not an accounting ledger or payment processor.

Each input array is limited to 100,000 records; identifiers are at most 128 characters and money
values at most 1000 digits. Invalid currencies, duplicate IDs, zero payments or negative amounts
throw. Records and result collections are frozen. `bigint` amounts should be serialized as decimal
strings in JSON or storage.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
