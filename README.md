# Vault — Personal Finance App

Static HTML prototype. No backend, no persistence — all data is in-memory and resets on page refresh.

**Entry point:** `finance-app.html` — open this one. The others load into it via iframe.

## Test URL (after GitHub Pages is enabled)
```
https://<your-username>.github.io/PFA/finance-app.html
```

---

## What's real (built + wired)

- **Dashboard** — static demo data (net worth, accounts, security center). Not connected to anything.
- **Add Transaction** (`modal-add-transaction.html`) — full form: Expense/Income/Transfer, categories, recurring toggle, receipt attach, validation. Saving adds a row to the dashboard transaction list.
- **Budgets** (`page-budgets.html`) — full page: per-category budget cards, progress bars, add/edit/delete, rollover toggle, unbudgeted spending tracker.
- **Transaction → Budget wiring** — saving an *expense* transaction updates the matching budget's spent total. Works whether or not you're currently on the Budgets page (queued and flushed on navigation). Income/transfers do **not** affect budgets — intentional.
- **Loans** (`modal-loans.html`) — full modal: "I Owe This" (mortgage/auto/student/personal, rate, payment, rough payoff estimate) vs "Owed To Me" (simple IOU). Saving adds to a bare-bones list.

## What's a stub (looks present, isn't finished)

- **Loans list view** — exists only so the modal has somewhere to send data. No summary cards, no payoff charts, no loan-payment-to-budget wiring. Needs its own design pass, same level as Budgets.
- **Transactions nav item** — does nothing. No dedicated page yet.
- **Accounts / Investments / Security nav items** — do nothing. Dashboard has static cards for these but no real pages.

## Known limitations (by design, not bugs)

- **No persistence.** Refresh = data gone. Every modal's `onSave` callback is the deliberate hook point for wiring up real storage later.
- **Loan payoff estimate is approximate**, not a precise amortization schedule — labeled as such in the UI.
- **Category casing mismatch was fixed** between the transaction modal (lowercase keys) and budget page (capitalized names) via an explicit translation map in `finance-app.html` — if you add new categories to either file, update that map too or spend will silently stop tracking.

## Specific things to check on mobile

1. Add an expense transaction → confirm it appears in the dashboard list
2. Navigate to Budgets → confirm the matching category's spent amount increased
3. Navigate to Loans → add a loan, confirm payoff estimate looks sane, confirm it lands in the list
4. Resize/rotate — these were designed desktop-first; mobile responsiveness has not been verified yet
