// ════════════════════════════════════════════════════════════
// VAULT — Supabase Client & Database Layer
// Import this file in every page that needs data access.
// All DB operations go through functions in this file —
// pages never call Supabase directly, so if the schema
// or client changes there's exactly one place to update.
// ════════════════════════════════════════════════════════════

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://uamvlzvtfqboyefeylwb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhbXZsenZ0ZnFib3llZmV5bHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NjE2MzIsImV4cCI6MjA5ODQzNzYzMn0.eeDe1YThvCj1cOKgVLdMM5_ouxRO8KrGyB8zNH0l_rk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ────────────────────────────────────────
// AUTH
// ────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// ────────────────────────────────────────
// ACCOUNTS
// ────────────────────────────────────────
export async function loadAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select(`*, account_adjustments(*)`)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function saveAccount(account) {
  const userId = (await supabase.auth.getUser()).data.user.id;
  const row = {
    user_id:         userId,
    name:            account.name,
    type:            account.type || '',
    currency:        account.currency,
    opening_balance: account.openingBalance,
    tx_delta:        account.txDelta || 0,
    notes:           account.notes || '',
  };
  if (account.id && !account.id.startsWith('acc')) {
    // Existing persisted record — update
    const { error } = await supabase.from('accounts').update(row).eq('id', account.id);
    if (error) throw error;
  } else {
    // New record
    const { data, error } = await supabase.from('accounts').insert(row).select().single();
    if (error) throw error;
    return data.id;
  }
}

export async function deleteAccount(id) {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) throw error;
}

export async function saveAdjustment(accountId, adj) {
  const userId = (await supabase.auth.getUser()).data.user.id;
  const { error } = await supabase.from('account_adjustments').insert({
    user_id:    userId,
    account_id: accountId,
    dir:        adj.dir,
    amount:     adj.amount,
    date:       adj.date,
    note:       adj.note || '',
  });
  if (error) throw error;
}

export async function updateAccountTxDelta(accountId, delta) {
  // Increment the running tx_delta for an account after a transaction is posted.
  // Uses RPC to avoid a read-modify-write race — safe for concurrent sessions.
  const { error } = await supabase.rpc('increment_tx_delta', {
    p_account_id: accountId,
    p_delta:      delta,
  });
  if (error) {
    // Fallback if RPC not set up yet: read current, write new
    const { data } = await supabase.from('accounts').select('tx_delta').eq('id', accountId).single();
    const current = data?.tx_delta || 0;
    await supabase.from('accounts').update({ tx_delta: current + delta }).eq('id', accountId);
  }
}

// ────────────────────────────────────────
// TRANSACTIONS
// ────────────────────────────────────────
export async function loadTransactions() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveTransaction(tx) {
  const userId = (await supabase.auth.getUser()).data.user.id;
  const { data, error } = await supabase.from('transactions').insert({
    user_id:           userId,
    type:              tx.type,
    amount:            tx.amount,
    original_currency: tx.originalCurrency || 'MVR',
    original_amount:   tx.originalAmount   || tx.amount,
    description:       tx.description,
    date:              tx.date,
    account_id:        tx.type !== 'transfer' ? (tx.account || null) : null,
    from_account_id:   tx.type === 'transfer' ? (tx.fromAccount || null) : null,
    to_account_id:     tx.type === 'transfer' ? (tx.toAccount   || null) : null,
    category:          tx.category || null,
    recurring:         tx.recurring || false,
    frequency:         tx.frequency || null,
    notes:             tx.notes || '',
  }).select().single();
  if (error) throw error;
  return data;
}

// ────────────────────────────────────────
// BUDGETS
// ────────────────────────────────────────
export async function loadBudgets(month) {
  // month format: 'YYYY-MM'
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('month', month)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function saveBudget(budget, month) {
  const userId = (await supabase.auth.getUser()).data.user.id;
  const row = {
    user_id:         userId,
    category:        budget.cat,
    month,
    limit_amount:    budget.limit,
    spent_amount:    budget.spent,
    alert_threshold: budget.alert,
    rollover:        budget.rollover,
    emoji:           budget.em || '',
  };
  if (budget.id && typeof budget.id === 'string' && budget.id.length === 36) {
    const { error } = await supabase.from('budgets').update(row).eq('id', budget.id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('budgets').insert(row).select().single();
    if (error) throw error;
    return data.id;
  }
}

export async function deleteBudget(id) {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw error;
}

export async function updateBudgetSpent(budgetId, spent) {
  const { error } = await supabase.from('budgets').update({ spent_amount: spent }).eq('id', budgetId);
  if (error) throw error;
}

// ────────────────────────────────────────
// LOANS
// ────────────────────────────────────────
export async function loadLoans() {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function saveLoan(loan) {
  const userId = (await supabase.auth.getUser()).data.user.id;
  const row = {
    user_id:    userId,
    direction:  loan.direction,
    loan_type:  loan.loanType  || null,
    name:       loan.name,
    party:      loan.party,
    currency:   loan.currency,
    principal:  loan.principal,
    balance:    loan.balance,
    payment:    loan.payment   || null,
    rate:       loan.rate      || null,
    frequency:  loan.frequency || null,
    due_date:   loan.dueDate   || null,
    reminder:   loan.reminder  || false,
    notes:      loan.notes     || '',
  };
  const { data, error } = await supabase.from('loans').insert(row).select().single();
  if (error) throw error;
  return data.id;
}

export async function deleteLoan(id) {
  const { error } = await supabase.from('loans').delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────
// INVESTMENTS
// ────────────────────────────────────────
export async function loadInvestments() {
  const { data, error } = await supabase
    .from('investments')
    .select(`*, investment_entries(*)`)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function saveInvestment(holding) {
  const userId = (await supabase.auth.getUser()).data.user.id;
  const { data, error } = await supabase.from('investments').insert({
    user_id:  userId,
    symbol:   holding.symbol,
    name:     holding.name,
    currency: holding.currency,
  }).select().single();
  if (error) throw error;
  return data.id;
}

export async function saveInvestmentEntry(investmentId, entry) {
  const userId = (await supabase.auth.getUser()).data.user.id;
  const { data, error } = await supabase.from('investment_entries').insert({
    user_id:       userId,
    investment_id: investmentId,
    side:          entry.side,
    qty:           entry.qty,
    rate:          entry.rate,
    fee:           entry.fee  || 0,
    date:          entry.date,
    notes:         entry.notes || '',
  }).select().single();
  if (error) throw error;
  return data.id;
}

export async function deleteInvestment(id) {
  const { error } = await supabase.from('investments').delete().eq('id', id);
  if (error) throw error;
}
