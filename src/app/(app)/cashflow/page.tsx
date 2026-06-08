'use client'
/*
 * CASH FLOW COMMAND CENTER
 * Migration: supabase/migrations/cashflow_command_center.sql (cash_balances table)
 * All analytics from real Supabase data. No mock data.
 * Font names with spaces: template literals or double-quoted strings only.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
} from 'recharts'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import CountUp from 'react-countup'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type IncomeRow   = { id: string; date: string; amount: number; client_name?: string; status: string; category: string }
type ExpenseRow  = { id: string; date: string; amount: number; category: string; vendor: string; is_subscription?: boolean; subscription_period?: string }
type InvoiceRow  = { id: string; invoice_number: string; status: string; total?: number; balance_due?: number; client_name: string; due_date?: string; created_at: string }
type CashBalance = { id: string; account_name: string; balance: number; balance_date: string; notes?: string }
type DrawerMode  = 'income' | 'expense' | 'bank' | null
type WhatIfId    = 'rev-drop-10' | 'rev-drop-20' | 'add-500-exp' | 'add-2k-exp' | 'collect-overdue' | 'lose-top' | 'custom' | null
type Range       = '30d' | '60d' | '90d' | '6m' | '12m' | 'all'

/* ─── Learn-more content ─────────────────────────────────────────────────── */
const LEARN: Record<string, { title: string; def: string; matters: string; example: string; next: string }> = {
  cashIn:         { title: 'Cash In',          def: 'Cash In is the total money your business received during a period — from clients, sales, or any other income source.',       matters: 'Tracking Cash In shows exactly how much money your business generates. Without it you cannot know if you are growing or shrinking.',                                                 example: 'You received $3,000 from a client project and $500 from a product sale. Cash In = $3,500.',                                            next: 'Record every income payment in the Income module immediately, even small ones.' },
  cashOut:        { title: 'Cash Out',          def: 'Cash Out is the total money your business spent during a period — on software, contractors, rent, or any expense.',          matters: 'Knowing Cash Out helps you identify where money goes and spot opportunities to cut costs.',                                                                                      example: 'You spent $200 on software, $500 on advertising, $100 on supplies. Cash Out = $800.',                                                   next: 'Log every expense immediately. Consistency creates the data you need to forecast.' },
  netCashFlow:    { title: 'Net Cash Flow',     def: 'Net Cash Flow is Cash In minus Cash Out. Positive = you earned more than spent. Negative = opposite.',                      matters: 'Net Cash Flow is the most important business number. Consistently negative means you are losing money faster than making it.',                                                    example: 'Cash In $5,000, Cash Out $3,200 → Net Cash Flow +$1,800. That is $1,800 added to your business.',                                      next: 'Aim for positive Net Cash Flow every month. If negative, review your largest expenses first.' },
  runway:         { title: 'Runway',            def: 'Runway is how many months your business can keep operating if income stopped today, based on current savings and spending.', matters: 'Runway gives you time to make changes. 1 month of runway is crisis. 6+ months is freedom to invest and grow.',                                                                  example: 'Net cash $15,000, spending $3,000/mo → 5 months of runway before you run out.',                                                        next: 'Keep at least 3 months of runway. Use the What-If Simulator to see how decisions affect it.' },
  burnRate:       { title: 'Burn Rate',         def: 'Burn Rate is the average amount your business spends per month, calculated from your last 3 months of expenses.',           matters: 'Your Burn Rate determines your Runway. Reducing it by even 10–20% can add months of safety.',                                                                                  example: 'You spent $2,800, $3,200, $3,000 over 3 months. Burn Rate = $3,000/month.',                                                           next: 'Review your largest expense categories. Even small reductions add up quickly over a year.' },
  collectionRate: { title: 'Collection Rate',   def: 'Collection Rate is the percentage of invoiced money you have actually received. 100% means every invoice was paid.',        matters: 'Low Collection Rate means money sitting in unpaid invoices instead of your bank account. Chasing payments costs time and creates cash gaps.',                                     example: 'You invoiced $10,000, collected $8,500. Collection Rate = 85%. $1,500 is still outstanding.',                                          next: 'Follow up on unpaid invoices at 7, 14, and 30 days. A simple email dramatically improves collections.' },
  forecast:       { title: 'Forecast',          def: 'A Forecast is an educated estimate of your future income and expenses based on historical patterns and current trends.',     matters: 'Forecasting prevents surprises. Knowing what next month looks like lets you prepare and adjust before a crisis happens.',                                                       example: 'You averaged $4,000 income and $2,500 expenses over 3 months → 30-day forecast is roughly +$1,500 net.',                              next: 'Check the 30-day forecast weekly. If it turns negative, investigate immediately.' },
  whatIf:         { title: 'What-If Simulator', def: 'The What-If Simulator lets you model financial decisions before making them — to see the effect on runway and cash.',        matters: 'Every business decision has a cash cost. Simulating scenarios helps you answer "Can I afford this?" with data.',                                                                 example: 'Wondering what happens if you add a $2,000/month contractor? Simulate it and see exactly how it affects your runway.',                  next: 'Use the simulator before any major spending or hiring decision.' },
  obligations:    { title: 'Obligations',       def: 'Obligations are upcoming payments your business is expected to make — rent, subscriptions, tax deadlines, payroll.',        matters: 'Knowing what is due when prevents cash flow surprises. Many businesses run out of cash not because they are unprofitable, but because they did not see obligations coming.',   example: 'Rent on the 1st, software subscriptions mid-month, quarterly taxes — all planned, none a surprise.',                                   next: 'Review upcoming obligations each Monday to stay ahead of your cash needs.' },
  subscriptions:  { title: 'Subscription Drain',def: 'Subscriptions are recurring payments that automatically leave your account every month. They are easy to forget and accumulate.', matters: 'The average business spends 15–30% more on subscriptions than they realise. Auditing quarterly saves hundreds or thousands per year.',                                           example: 'You have 8 tool subscriptions at $20–$150 each. Total: $460/month = $5,520/year.',                                                     next: 'List every subscription. Cancel any you have not used in 30 days.' },
}

/* ─── Utilities ──────────────────────────────────────────────────────────── */
function fmt$(n: number, dec = 2) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}
function monthLabel(d: Date) { return d.toLocaleString('default', { month: 'short', year: '2-digit' }) }

/* ─── Info + Learn icon ──────────────────────────────────────────────────── */
function InfoLearnIcon({ topic, onLearn, tip }: { topic: string; onLearn: (t: string) => void; tip: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
      <button type="button"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)}
        onClick={e => { e.stopPropagation(); onLearn(topic) }}
        style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--bd2)', color: 'var(--mu)', fontSize: 9, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>
        i
      </button>
      {show && (
        <span role="tooltip" style={{ position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: 'var(--ink)', lineHeight: 1.6, width: 200, zIndex: 99, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', pointerEvents: 'none', whiteSpace: 'normal', fontWeight: 400 }}>
          {tip}
          <span style={{ display: 'block', marginTop: 3, color: '#6366f1', fontWeight: 700, fontSize: 10 }}>Click to learn more →</span>
        </span>
      )}
    </span>
  )
}

/* ─── Learn Drawer ───────────────────────────────────────────────────────── */
function LearnDrawer({ topic, onClose }: { topic: string | null; onClose: () => void }) {
  const c = topic ? LEARN[topic] : null
  useEffect(() => {
    if (!topic) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h)
  }, [topic, onClose])
  return (
    <AnimatePresence>
      {topic && c && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 799 }} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="side-drawer-panel"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
              <h3 style={{ fontWeight: 900, fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{c.title}</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { label: 'What it means', body: c.def, color: '#6366f1' },
                { label: 'Why it matters', body: c.matters, color: '#10b981' },
                { label: 'Example', body: c.example, color: '#0ea5e9', bg: true },
                { label: 'What to do next', body: c.next, color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} style={s.bg ? { padding: '14px 16px', borderRadius: 12, background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' } : {}}>
                  <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: s.color, marginBottom: 8 }}>{s.label}</p>
                  <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Quick Add Income Drawer ────────────────────────────────────────────── */
function QuickAddIncomeDrawer({ open, onClose, userId, onSaved }: {
  open: boolean; onClose: () => void; userId: string; onSaved: (i: IncomeRow) => void
}) {
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', client_name: '', category: 'Design', payment_method: 'Bank Transfer', status: 'received' })
  const [saving, setSaving] = useState(false)
  const CATS = ['Design','Development','Consulting','Photography','Retainer','E-commerce','Coaching','Writing','Marketing','Other']
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h) }, [open, onClose])
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!form.amount) return; setSaving(true)
    const sb = createClient()
    const { data, error } = await sb.from('income').insert({ user_id: userId, ...form, amount: parseFloat(form.amount) }).select().single()
    setSaving(false)
    if (error) { toast.error('Failed to add income'); return }
    toast.success('Income added ✓'); onSaved(data as IncomeRow); onClose()
    setForm({ date: new Date().toISOString().split('T')[0], amount: '', client_name: '', category: 'Design', payment_method: 'Bank Transfer', status: 'received' })
  }
  const iS: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }
  const lS: React.CSSProperties = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block' }
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 799 }} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="side-drawer-panel"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
              <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Record Income</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22 }}>×</button>
            </div>
            <form onSubmit={save} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={lS}>Client / Source</label><input style={iS} placeholder="Acme Corp" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} /></div>
              <div><label style={lS}>Amount ($) *</label>
                <div style={{ position: 'relative', marginTop: 6 }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 14 }}>$</span>
                  <input style={{ ...iS, marginTop: 0, paddingLeft: 26 }} type="number" min="0" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              <div><label style={lS}>Date *</label><input style={iS} type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label style={lS}>Category</label>
                <select style={iS} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={lS}>Status</label>
                <select style={iS} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="received">Received</option><option value="pending">Pending</option>
                </select>
              </div>
            </form>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 10 }}>
              <button onClick={save as unknown as React.MouseEventHandler} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '13px', fontSize: 14 }}>
                {saving ? 'Saving…' : 'Record Income'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '13px 20px' }}>Cancel</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Quick Add Expense Drawer ───────────────────────────────────────────── */
function QuickAddExpenseDrawer({ open, onClose, userId, onSaved }: {
  open: boolean; onClose: () => void; userId: string; onSaved: (e: ExpenseRow) => void
}) {
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', vendor: '', category: 'Operations', payment_method: 'Bank Transfer', is_deductible: true, status: 'paid', is_subscription: false })
  const [saving, setSaving] = useState(false)
  const CATS = ['Operations','Software','Marketing','Payroll','Office','Travel','Meals','Equipment','Professional Services','Insurance','Rent','Utilities','Other']
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h) }, [open, onClose])
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!form.amount || !form.vendor) return; setSaving(true)
    const sb = createClient()
    const { data, error } = await sb.from('expenses').insert({ user_id: userId, ...form, amount: parseFloat(form.amount) }).select().single()
    setSaving(false)
    if (error) { toast.error('Failed to add expense'); return }
    toast.success('Expense added ✓'); onSaved(data as ExpenseRow); onClose()
    setForm({ date: new Date().toISOString().split('T')[0], amount: '', vendor: '', category: 'Operations', payment_method: 'Bank Transfer', is_deductible: true, status: 'paid', is_subscription: false })
  }
  const iS: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }
  const lS: React.CSSProperties = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block' }
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 799 }} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="side-drawer-panel"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
              <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Add Expense</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22 }}>×</button>
            </div>
            <form onSubmit={save} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={lS}>Vendor *</label><input style={iS} required placeholder="Adobe, AWS…" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} /></div>
              <div><label style={lS}>Amount ($) *</label>
                <div style={{ position: 'relative', marginTop: 6 }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 14 }}>$</span>
                  <input style={{ ...iS, marginTop: 0, paddingLeft: 26 }} type="number" min="0" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              <div><label style={lS}>Date *</label><input style={iS} type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label style={lS}>Category</label>
                <select style={iS} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)', minHeight: 44 }}>
                  <input type="checkbox" checked={form.is_deductible} onChange={e => setForm(f => ({ ...f, is_deductible: e.target.checked }))} /> Tax deductible
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)', minHeight: 44 }}>
                  <input type="checkbox" checked={form.is_subscription} onChange={e => setForm(f => ({ ...f, is_subscription: e.target.checked }))} /> Subscription
                </label>
              </div>
            </form>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 10 }}>
              <button onClick={save as unknown as React.MouseEventHandler} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '13px', fontSize: 14 }}>
                {saving ? 'Saving…' : 'Add Expense'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '13px 20px' }}>Cancel</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Connect Bank Modal ─────────────────────────────────────────────────── */
function ConnectBankModal({ open, onClose, userId, onBalanceSaved }: {
  open: boolean; onClose: () => void; userId: string
  onBalanceSaved: (b: CashBalance) => void
}) {
  const [tab, setTab] = useState<'integrations'|'manual'>('manual')
  const [form, setForm] = useState({ account_name: 'Primary Account', balance: '', balance_date: new Date().toISOString().split('T')[0], notes: '' })
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h) }, [open, onClose])

  async function saveBalance(e: React.FormEvent) {
    e.preventDefault(); if (!form.balance) return; setSaving(true)
    const sb = createClient()
    const { data, error } = await sb.from('cash_balances').insert({ user_id: userId, ...form, balance: parseFloat(form.balance) }).select().single()
    setSaving(false)
    if (error) { toast.error('Failed to save balance. Run the cash_balances migration first.'); return }
    toast.success('Cash balance saved ✓'); onBalanceSaved(data as CashBalance); onClose()
  }

  const iS: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }
  const lS: React.CSSProperties = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block' }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 899 }} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 520, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 20, zIndex: 900, boxShadow: '0 30px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
              <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Connect Financial Accounts</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22 }}>×</button>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--bd)' }}>
              {([{ key: 'manual', label: 'Manual Balance' }, { key: 'integrations', label: 'Bank / Payments' }] as const).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? '#6366f1' : 'var(--mu)', borderBottom: tab === t.key ? '2px solid #6366f1' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>
              {tab === 'manual' ? (
                <form onSubmit={saveBalance}>
                  <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 20, lineHeight: 1.6 }}>Enter your current account balance to get accurate runway calculations. FINNMGR will use this as the starting point and add/subtract your income and expenses from that date.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1/-1' }}><label style={lS}>Account Name</label><input style={iS} value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} /></div>
                    <div><label style={lS}>Current Balance ($) *</label>
                      <div style={{ position: 'relative', marginTop: 6 }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 14 }}>$</span>
                        <input style={{ ...iS, marginTop: 0, paddingLeft: 26 }} type="number" step="0.01" required value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0.00" />
                      </div>
                    </div>
                    <div><label style={lS}>As of Date *</label><input style={iS} type="date" required value={form.balance_date} onChange={e => setForm(f => ({ ...f, balance_date: e.target.value }))} /></div>
                    <div style={{ gridColumn: '1/-1' }}><label style={lS}>Notes (optional)</label><input style={iS} placeholder="Business checking account…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>
                      {saving ? 'Saving…' : 'Save Balance'}
                    </button>
                    <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '12px 20px' }}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 20, lineHeight: 1.6 }}>Connect your bank accounts and payment processors to import transactions automatically. All integrations use bank-level encryption.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { name: 'Plaid', icon: '🏦', desc: 'Bank accounts' },
                      { name: 'Stripe', icon: '💳', desc: 'Payment processor' },
                      { name: 'Square', icon: '◼', desc: 'POS & payments' },
                      { name: 'PayPal', icon: '🅿️', desc: 'Online payments' },
                      { name: 'Shopify', icon: '🛒', desc: 'E-commerce' },
                      { name: 'Gusto', icon: '👥', desc: 'Payroll' },
                    ].map(a => (
                      <button key={a.name} onClick={() => toast(`${a.name} integration coming soon 🚀`)}
                        style={{ padding: '14px', borderRadius: 12, border: '1px solid var(--bd)', background: 'var(--bg3)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = '1px solid #6366f1' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = '1px solid var(--bd)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 20 }}>{a.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{a.name}</span>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--mu)' }}>{a.desc}</p>
                        <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Coming Soon</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Chart tooltip ──────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 11, minWidth: 150 }}>
      <p style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 5 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>{p.name}: <strong>{fmt$(p.value)}</strong></p>)}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function CashflowPage() {
  const router = useRouter()

  const [incomeData, setIncomeData]     = useState<IncomeRow[]>([])
  const [expenseData, setExpenseData]   = useState<ExpenseRow[]>([])
  const [invoiceData, setInvoiceData]   = useState<InvoiceRow[]>([])
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([])
  const [loading, setLoading]           = useState(true)
  const [userId, setUserId]             = useState('')

  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [range, setRange]           = useState<Range>('6m')
  const [learnTopic, setLearnTopic] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [whatIfId, setWhatIfId]     = useState<WhatIfId>(null)
  const [customWhatIfAmt, setCustomWhatIfAmt]   = useState('')
  const [customWhatIfType, setCustomWhatIfType] = useState<'income'|'expense'>('expense')
  const [showFullTimeline, setShowFullTimeline] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [incRes, expRes, invRes] = await Promise.all([
      sb.from('income').select('id,date,amount,client_name,status,category').eq('user_id', user.id),
      sb.from('expenses').select('id,date,amount,category,vendor,is_subscription,subscription_period').eq('user_id', user.id),
      sb.from('invoices').select('id,invoice_number,status,total,balance_due,client_name,due_date,created_at').eq('user_id', user.id),
    ])
    setIncomeData(incRes.data ?? [])
    setExpenseData(expRes.data ?? [])
    setInvoiceData(invRes.data ?? [])
    // Try loading cash_balances (may not exist if migration not run)
    try {
      const { data: balRes } = await sb.from('cash_balances').select('*').eq('user_id', user.id).order('balance_date', { ascending: false })
      setCashBalances(balRes ?? [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ════════════════════════════════════════════════════════════════════
     CENTRALISED COMPUTED DATA
  ════════════════════════════════════════════════════════════════════ */
  const d = useMemo(() => {
    const now          = new Date()
    const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevStart    = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevEnd      = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const threeAgo     = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const daysElapsed  = now.getDate()
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    /* ── All-time totals ── */
    const totalIncome   = incomeData.reduce((s, i) => s + Number(i.amount), 0)
    const totalExpenses = expenseData.reduce((s, e) => s + Number(e.amount), 0)

    /* ── Current month ── */
    const thisInc = incomeData.filter(i => new Date(i.date) >= monthStart).reduce((s, i) => s + Number(i.amount), 0)
    const thisExp = expenseData.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + Number(e.amount), 0)
    const thisNet = thisInc - thisExp

    /* ── Previous month ── */
    const prevInc = incomeData.filter(i => { const d = new Date(i.date); return d >= prevStart && d <= prevEnd }).reduce((s, i) => s + Number(i.amount), 0)
    const prevExp = expenseData.filter(e => { const d = new Date(e.date); return d >= prevStart && d <= prevEnd }).reduce((s, e) => s + Number(e.amount), 0)

    /* ── Averages (3-month) ── */
    const inc3m    = incomeData.filter(i => new Date(i.date) >= threeAgo).reduce((s, i) => s + Number(i.amount), 0)
    const exp3m    = expenseData.filter(e => new Date(e.date) >= threeAgo).reduce((s, e) => s + Number(e.amount), 0)
    const avgInc   = inc3m / 3
    const avgExp   = exp3m > 0 ? exp3m / 3 : totalExpenses > 0 ? totalExpenses / Math.max(1, new Set(expenseData.map(e => e.date.substring(0, 7))).size) : 0

    /* ── Cash balance ── */
    const latestBalance = cashBalances[0]
    let netCash = totalIncome - totalExpenses
    if (latestBalance) {
      // Actual cash = manual balance + income since that date - expenses since that date
      const balDate = new Date(latestBalance.balance_date)
      const incSince = incomeData.filter(i => new Date(i.date) > balDate).reduce((s, i) => s + Number(i.amount), 0)
      const expSince = expenseData.filter(e => new Date(e.date) > balDate).reduce((s, e) => s + Number(e.amount), 0)
      netCash = Number(latestBalance.balance) + incSince - expSince
    }
    const cashRunway = avgExp > 0 ? Math.max(0, netCash / avgExp) : 0

    /* ── Trends ── */
    const incGrowthPct = prevInc > 0 ? ((thisInc - prevInc) / prevInc) * 100 : thisInc > 0 ? 100 : 0
    const expGrowthPct = prevExp > 0 ? ((thisExp - prevExp) / prevExp) * 100 : thisExp > 0 ? 100 : 0
    const trendFactor  = Math.max(-0.3, Math.min(0.3, incGrowthPct / 100))

    /* ── Projection ── */
    const dailyIncRate  = daysElapsed > 0 ? thisInc / daysElapsed : 0
    const projMonthEnd  = dailyIncRate * daysInMonth
    const projMonthEndExp = avgExp

    /* ── Invoices ── */
    const unpaid          = invoiceData.filter(i => ['sent','overdue','viewed','partial'].includes(i.status))
    const overdue         = invoiceData.filter(i => i.status === 'overdue')
    const totalOutstanding = unpaid.reduce((s, i) => s + Math.max(0, Number(i.balance_due ?? i.total ?? 0)), 0)
    const overdueAmt      = overdue.reduce((s, i) => s + Math.max(0, Number(i.balance_due ?? i.total ?? 0)), 0)
    const totalInvoiced   = invoiceData.filter(i => i.status !== 'draft').reduce((s, i) => s + Number(i.total ?? 0), 0)
    const totalCollected  = invoiceData.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total ?? 0), 0)
    const collectionRate  = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 100

    /* ── Subscriptions ── */
    const vendorMonths: Record<string, { months: Set<string>; amounts: number[]; cat: string }> = {}
    expenseData.forEach(e => {
      const key = e.vendor.toLowerCase().trim()
      if (!vendorMonths[key]) vendorMonths[key] = { months: new Set(), amounts: [], cat: e.category }
      vendorMonths[key].months.add(e.date.substring(0, 7))
      vendorMonths[key].amounts.push(Number(e.amount))
      vendorMonths[key].cat = e.category
    })
    const subs = Object.entries(vendorMonths)
      .filter(([_, v]) => v.months.size >= 2)
      .map(([vendor, v]) => {
        const avg = v.amounts.reduce((s, a) => s + a, 0) / v.amounts.length
        const cv  = avg > 0 ? Math.sqrt(v.amounts.map(a => (a - avg) ** 2).reduce((s, x) => s + x, 0) / v.amounts.length) / avg : 1
        return { vendor, monthlyAvg: avg, months: v.months.size, cat: v.cat, cv }
      })
      .filter(s => s.cv < 0.25).sort((a, b) => b.monthlyAvg - a.monthlyAvg).slice(0, 8)
    const subMonthlyTotal = subs.reduce((s, x) => s + x.monthlyAvg, 0)

    /* ── Top client monthly contribution ── */
    const cliMonthly: Record<string, number> = {}
    incomeData.filter(i => new Date(i.date) >= threeAgo).forEach(i => {
      if (i.client_name) cliMonthly[i.client_name] = (cliMonthly[i.client_name] ?? 0) + Number(i.amount) / 3
    })
    const topClientEntry = Object.entries(cliMonthly).sort((a, b) => b[1] - a[1])[0]
    const topClientMonthly = topClientEntry?.[1] ?? 0
    const topClientName    = topClientEntry?.[0] ?? 'Top client'

    /* ── Cash leaks / category spikes ── */
    const catPrevMonth: Record<string, number> = {}
    const catThisMonth: Record<string, number> = {}
    expenseData.filter(e => { const d = new Date(e.date); return d >= prevStart && d <= prevEnd }).forEach(e => { catPrevMonth[e.category] = (catPrevMonth[e.category] ?? 0) + Number(e.amount) })
    expenseData.filter(e => new Date(e.date) >= monthStart).forEach(e => { catThisMonth[e.category] = (catThisMonth[e.category] ?? 0) + Number(e.amount) })
    const leaks = Object.entries(catThisMonth)
      .map(([cat, curr]) => ({ cat, curr, prev: catPrevMonth[cat] ?? 0, growth: catPrevMonth[cat] ? ((curr - catPrevMonth[cat]) / catPrevMonth[cat]) * 100 : curr > 0 ? 100 : 0 }))
      .filter(c => c.growth > 20 && c.curr > 50)
      .sort((a, b) => b.growth - a.growth).slice(0, 3)

    /* ── Health Score ── */
    let hs = 55
    if (netCash > 0) hs += 12; else if (netCash < 0) hs -= 12
    if (cashRunway > 6) hs += 12; else if (cashRunway > 3) hs += 6; else if (cashRunway < 1 && incomeData.length > 0) hs -= 18
    if (incGrowthPct > 10) hs += 8; else if (incGrowthPct < -15) hs -= 12; else if (incGrowthPct < -5) hs -= 6
    if (avgExp > 0 && avgInc / Math.max(1, avgExp) > 1.5) hs += 6; else if (avgInc < avgExp && incomeData.length > 2) hs -= 10
    if (overdueAmt > totalOutstanding * 0.4 && overdueAmt > 0) hs -= 8
    if (expGrowthPct > 25) hs -= 8
    hs = Math.max(0, Math.min(100, Math.round(hs)))
    const hlabel = hs >= 75 ? 'Excellent' : hs >= 55 ? 'Healthy' : hs >= 35 ? 'Watch Closely' : 'At Risk'
    const hcolor = hs >= 75 ? '#10b981' : hs >= 55 ? '#0ea5e9' : hs >= 35 ? '#f59e0b' : '#ef4444'

    /* ── Upcoming obligations ── */
    const nowMs    = Date.now()
    const taxYear  = now.getFullYear()
    const taxDeadlines = [
      { date: new Date(taxYear, 3, 15), label: 'Q1 Estimated Tax', amount: 0, type: 'tax' as const },
      { date: new Date(taxYear, 5, 15), label: 'Q2 Estimated Tax', amount: 0, type: 'tax' as const },
      { date: new Date(taxYear, 8, 15), label: 'Q3 Estimated Tax', amount: 0, type: 'tax' as const },
      { date: new Date(taxYear + 1, 0, 15), label: 'Q4 Estimated Tax', amount: 0, type: 'tax' as const },
    ].filter(d => d.date.getTime() > nowMs).slice(0, 2)

    const subsObligations = subs.map(s => {
      const lastExp = expenseData.filter(e => e.vendor.toLowerCase().trim() === s.vendor.toLowerCase().trim()).sort((a, b) => b.date.localeCompare(a.date))[0]
      const lastDate = lastExp ? new Date(lastExp.date) : new Date()
      const nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate())
      return { date: nextDate, label: s.vendor, amount: s.monthlyAvg, type: 'subscription' as const, daysUntil: Math.round((nextDate.getTime() - nowMs) / 86400000) }
    }).filter(o => o.daysUntil > -5 && o.daysUntil < 45).sort((a, b) => a.date.getTime() - b.date.getTime())

    const invoiceObligations = unpaid.filter(i => i.due_date).map(i => ({
      date: new Date(i.due_date!), label: `${i.invoice_number} (${i.client_name})`,
      amount: Math.max(0, Number(i.balance_due ?? i.total ?? 0)), type: 'invoice' as const,
      daysUntil: Math.round((new Date(i.due_date!).getTime() - nowMs) / 86400000),
      isOverdue: new Date(i.due_date!).getTime() < nowMs,
    })).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5)

    return {
      totalIncome, totalExpenses, netCash, thisInc, thisExp, thisNet,
      prevInc, prevExp, incGrowthPct, expGrowthPct, trendFactor,
      avgInc, avgExp, subMonthlyTotal, subs,
      cashRunway, collectionRate, totalOutstanding, overdueAmt, unpaid,
      projMonthEnd, projMonthEndExp, daysElapsed, daysInMonth,
      hs, hlabel, hcolor, leaks,
      topClientMonthly, topClientName,
      taxDeadlines, subsObligations, invoiceObligations,
    }
  }, [incomeData, expenseData, invoiceData, cashBalances])

  /* ── What-If computation ── */
  const whatIfResult = useMemo(() => {
    if (!whatIfId) return null
    const { avgInc, avgExp, netCash, cashRunway, topClientMonthly, totalOutstanding } = d
    let newMonthlyInc = avgInc
    let newMonthlyExp = avgExp
    let newNetCash    = netCash

    if (whatIfId === 'rev-drop-10')   newMonthlyInc = avgInc * 0.9
    else if (whatIfId === 'rev-drop-20') newMonthlyInc = avgInc * 0.8
    else if (whatIfId === 'add-500-exp') newMonthlyExp = avgExp + 500
    else if (whatIfId === 'add-2k-exp')  newMonthlyExp = avgExp + 2000
    else if (whatIfId === 'collect-overdue') newNetCash = netCash + totalOutstanding
    else if (whatIfId === 'lose-top')    newMonthlyInc = Math.max(0, avgInc - topClientMonthly)
    else if (whatIfId === 'custom') {
      const amt = parseFloat(customWhatIfAmt) || 0
      if (customWhatIfType === 'income') newMonthlyInc = avgInc + amt
      else newMonthlyExp = avgExp + amt
    }

    const newRunway = newMonthlyExp > 0 ? Math.max(0, newNetCash / newMonthlyExp) : 99
    const runwayDelta = newRunway - cashRunway
    const monthlyNetDelta = (newMonthlyInc - avgInc) - (newMonthlyExp - avgExp)
    const riskColor = newRunway < 1 ? '#ef4444' : newRunway < 3 ? '#f59e0b' : '#10b981'
    const riskLabel = newRunway < 1 ? 'Critical' : newRunway < 3 ? 'High Risk' : newRunway < 6 ? 'Moderate' : 'Low Risk'

    return { runwayBefore: cashRunway, runwayAfter: newRunway, runwayDelta, monthlyNetDelta, riskColor, riskLabel, newNetCash }
  }, [whatIfId, customWhatIfAmt, customWhatIfType, d])

  /* ── Chart data ── */
  const chartData = useMemo(() => {
    const now = new Date()
    let months: number
    if (range === '30d') {
      return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now); d.setDate(d.getDate() - (29 - i))
        const ds = d.toISOString().split('T')[0]
        const inc = incomeData.filter(x => x.date === ds).reduce((s, x) => s + Number(x.amount), 0)
        const exp = expenseData.filter(x => x.date === ds).reduce((s, x) => s + Number(x.amount), 0)
        return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), income: inc, expenses: exp, net: inc - exp }
      })
    }
    months = range === '60d' ? 2 : range === '90d' ? 3 : range === '6m' ? 6 : range === '12m' ? 12 : (() => {
      const dates = [...incomeData.map(i => i.date), ...expenseData.map(e => e.date)]
      if (!dates.length) return 6
      const e = new Date(Math.min(...dates.map(s => new Date(s).getTime())))
      return Math.max(1, (now.getFullYear() - e.getFullYear()) * 12 + (now.getMonth() - e.getMonth()) + 1)
    })()
    return Array.from({ length: months }, (_, i) => {
      const mo  = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
      const end = new Date(mo.getFullYear(), mo.getMonth() + 1, 0, 23, 59, 59)
      const inc = incomeData.filter(x => { const xd = new Date(x.date); return xd >= mo && xd <= end }).reduce((s, x) => s + Number(x.amount), 0)
      const exp = expenseData.filter(x => { const xd = new Date(x.date); return xd >= mo && xd <= end }).reduce((s, x) => s + Number(x.amount), 0)
      return { label: monthLabel(mo), income: inc, expenses: exp, net: inc - exp }
    })
  }, [incomeData, expenseData, range])

  /* ── Timeline ── */
  const timeline = useMemo(() => {
    type TEvent = { id: string; date: Date; title: string; amount: number; type: 'income'|'expense'|'upcoming-sub'|'invoice-due'; status: string; icon: string; color: string }
    const events: TEvent[] = []
    incomeData.slice(0, 30).forEach(i => events.push({ id: i.id, date: new Date(i.date), title: i.client_name || i.category, amount: Number(i.amount), type: 'income', status: i.status, icon: '💰', color: '#10b981' }))
    expenseData.slice(0, 30).forEach(e => events.push({ id: e.id, date: new Date(e.date), title: e.vendor, amount: -Number(e.amount), type: 'expense', status: 'paid', icon: e.is_subscription ? '🔄' : '🧮', color: '#ff7043' }))
    d.subsObligations.slice(0, 4).forEach(s => events.push({ id: `sub-${s.label}`, date: s.date, title: s.label, amount: -s.amount, type: 'upcoming-sub', status: 'upcoming', icon: '📅', color: '#f59e0b' }))
    d.invoiceObligations.slice(0, 4).forEach(i => events.push({ id: `inv-${i.label}`, date: i.date, title: i.label, amount: i.amount, type: 'invoice-due', status: i.isOverdue ? 'overdue' : 'upcoming', icon: '🧾', color: i.isOverdue ? '#ef4444' : '#0ea5e9' }))
    return events.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [incomeData, expenseData, d])

  /* ── Financial Coach ── */
  const coach = useMemo(() => {
    const items: { icon: string; msg: string; action?: string; priority: 'high'|'medium'|'low' }[] = []
    if (!incomeData.length && !expenseData.length) return items
    const { thisInc, thisExp, thisNet, cashRunway, collectionRate, totalOutstanding, subMonthlyTotal, incGrowthPct, expGrowthPct, leaks, overdueAmt, d: _ } = { ...d, d }

    if (thisInc > 0)
      items.push({ icon: '📊', msg: `Your business ${thisNet >= 0 ? 'generated' : 'spent'} ${fmt$(Math.abs(thisNet))} ${thisNet >= 0 ? 'more than it spent' : 'more than it earned'} this month.`, priority: thisNet >= 0 ? 'low' : 'high' })

    if (cashRunway > 0)
      items.push({ icon: '🛣️', msg: `You have ${cashRunway.toFixed(1)} months of runway${cashRunway < 3 ? ' — less than the recommended 3-month buffer' : ''}.`, priority: cashRunway > 3 ? 'low' : cashRunway > 1 ? 'medium' : 'high' })

    if (totalOutstanding > 500)
      items.push({ icon: '💸', msg: `Collecting outstanding invoices could improve cash by ${fmt$(totalOutstanding)}.`, action: 'View invoices', priority: totalOutstanding > 2000 ? 'high' : 'medium' })

    if (subMonthlyTotal > 0)
      items.push({ icon: '📱', msg: `Subscriptions cost ${fmt$(subMonthlyTotal)}/month (${fmt$(subMonthlyTotal * 12, 0)}/year). Audit quarterly for unused services.`, priority: 'low' })

    if (incGrowthPct < -10)
      items.push({ icon: '⚠️', msg: `Revenue declined ${Math.abs(incGrowthPct).toFixed(0)}% vs last month. Investigate your pipeline.`, priority: 'high' })
    else if (incGrowthPct > 10)
      items.push({ icon: '🚀', msg: `Revenue grew ${incGrowthPct.toFixed(0)}% vs last month. Strong momentum.`, priority: 'low' })

    if (leaks.length > 0)
      items.push({ icon: '🔍', msg: `${leaks[0].cat} spending increased ${leaks[0].growth.toFixed(0)}% this month. Review for unnecessary charges.`, priority: 'medium' })

    return items.slice(0, 5)
  }, [d, incomeData, expenseData])

  /* ── Exports ── */
  function exportCsv(rows: Record<string, unknown>[], fn: string) {
    if (!rows.length) { toast.error('No data to export'); return }
    const h = Object.keys(rows[0])
    const csv = [h.join(','), ...rows.map(r => h.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = fn; a.click()
    toast.success(`${fn} exported ✓`); setExportOpen(false)
  }
  const exportSummary  = () => exportCsv(chartData.map(r => ({ month: r.label, income: r.income.toFixed(2), expenses: r.expenses.toFixed(2), net: r.net.toFixed(2) })), 'cashflow_summary.csv')
  const exportSubs     = () => exportCsv(d.subs.map(s => ({ vendor: s.vendor, monthly: s.monthlyAvg.toFixed(2), annual: (s.monthlyAvg * 12).toFixed(2), category: s.cat })), 'subscriptions.csv')
  const exportInvoices = () => exportCsv(d.unpaid.map(i => ({ invoice: i.invoice_number, client: i.client_name, balance: Number(i.balance_due ?? i.total ?? 0).toFixed(2), status: i.status, due: i.due_date || '' })), 'invoice_impact.csv')

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 44, width: 280, marginBottom: 28 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          {[...Array(6)].map((_, i) => <div key={i} style={{ height: 100 }} className="skeleton" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} style={{ height: 220, marginBottom: 20 }} className="skeleton" />)}
      </div>
    )
  }

  const hasData = incomeData.length > 0 || expenseData.length > 0

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ══ HEADER ══ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Cash Flow</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Understand money movement, forecast your future, and protect your runway.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn-primary" style={{ minHeight: 44 }} onClick={() => setDrawerMode('income')}>+ Add Income</button>
            <button className="btn-ghost" style={{ minHeight: 44 }} onClick={() => setDrawerMode('expense')}>+ Add Expense</button>
            <button className="btn-ghost" style={{ minHeight: 44 }} onClick={() => setDrawerMode('bank')}>🏦 Connect Bank</button>
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" style={{ minHeight: 44 }} onClick={() => setExportOpen(s => !s)}>⬇ Export</button>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ position: 'absolute', top: '110%', right: 0, width: 210, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', zIndex: 40, padding: 8 }}>
                    {[
                      { label: 'Cash Flow Summary (CSV)', fn: exportSummary },
                      { label: 'Subscription Report (CSV)', fn: exportSubs },
                      { label: 'Invoice Impact (CSV)',    fn: exportInvoices },
                      { label: 'PDF Report',             fn: () => { toast('PDF coming soon 🚀'); setExportOpen(false) } },
                    ].map(x => (
                      <button key={x.label} onClick={x.fn}
                        style={{ display: 'block', width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', textAlign: 'left', borderRadius: 8, fontWeight: 500 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg3)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}>
                        {x.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ══ EMPTY STATE ══ */}
        {!hasData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ width: 88, height: 88, borderRadius: 28, background: 'linear-gradient(135deg,rgba(99,102,241,0.14),rgba(16,185,129,0.18))', border: '1.5px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, margin: '0 auto 24px', animation: 'float 3s ease-in-out infinite' }}>📈</div>
            <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.035em', marginBottom: 10 }}>Cash Flow Command Center</h2>
            <p style={{ fontSize: 14, color: 'var(--mu)', lineHeight: 1.7, maxWidth: 400, margin: '0 auto 32px' }}>Track money coming in, money going out, and forecast your future so you can avoid surprises.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, maxWidth: 680, margin: '0 auto 28px' }}>
              {[
                { icon: '💰', title: 'Track Income', desc: 'Record every payment received from clients and customers.', action: () => setDrawerMode('income'), btn: '+ Add Income' },
                { icon: '🧮', title: 'Track Expenses', desc: 'Log business spending to understand your burn rate.', action: () => setDrawerMode('expense'), btn: '+ Add Expense' },
                { icon: '🏦', title: 'Set Cash Balance', desc: 'Enter your current balance for accurate runway tracking.', action: () => setDrawerMode('bank'), btn: 'Connect / Set Balance' },
              ].map(c => (
                <div key={c.title} style={{ padding: '20px', borderRadius: 16, background: 'var(--bg3)', border: '1px solid var(--bd)', textAlign: 'left' }}>
                  <span style={{ fontSize: 24, display: 'block', marginBottom: 10 }}>{c.icon}</span>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{c.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 14, lineHeight: 1.55 }}>{c.desc}</p>
                  <button className="btn-ghost" style={{ fontSize: 12, width: '100%', justifyContent: 'center' }} onClick={c.action}>{c.btn}</button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {hasData && (
          <>
            {/* ══ 6 KPI CARDS ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { key: 'cashIn',         label: 'Cash In',           value: d.thisInc,    prefix: '$', color: '#10b981', icon: '💰', sub: d.incGrowthPct !== 0 ? `${d.incGrowthPct >= 0 ? '▲' : '▼'} ${Math.abs(d.incGrowthPct).toFixed(0)}% vs last mo` : 'This month', subColor: d.incGrowthPct >= 0 ? '#10b981' : '#ef4444', tip: 'Money your business received this month.' },
                { key: 'cashOut',        label: 'Cash Out',          value: d.thisExp,    prefix: '$', color: '#ff7043', icon: '🧮', sub: d.expGrowthPct !== 0 ? `${d.expGrowthPct >= 0 ? '▲' : '▼'} ${Math.abs(d.expGrowthPct).toFixed(0)}% vs last mo` : 'This month', subColor: d.expGrowthPct <= 0 ? '#10b981' : '#ef4444', tip: 'Money your business spent this month.' },
                { key: 'netCashFlow',    label: 'Net Cash Flow',     value: d.thisNet,    prefix: '$', color: d.thisNet >= 0 ? '#10b981' : '#ef4444', icon: '📊', sub: d.thisNet >= 0 ? 'Positive ✓' : 'Negative ⚠️', subColor: d.thisNet >= 0 ? '#10b981' : '#ef4444', tip: 'Cash In minus Cash Out. Positive means you earned more than you spent.' },
                { key: 'runway',         label: 'Runway',            value: d.cashRunway, prefix: '', suffix: ' mo', decimals: 1, color: d.cashRunway > 3 ? '#10b981' : d.cashRunway > 1 ? '#f59e0b' : '#ef4444', icon: '🛣️', sub: `${fmt$(d.avgExp, 0)}/mo burn`, tip: 'How long your business can keep operating if income stopped today.' },
                { key: 'burnRate',       label: 'Burn Rate',         value: d.avgExp,     prefix: '$', decimals: 0, color: '#f59e0b', icon: '🔥', sub: '3-month average', tip: 'Average money your business spends each month.' },
                { key: 'collectionRate', label: 'Collection Rate',   value: d.collectionRate, prefix: '', suffix: '%', decimals: 1, color: d.collectionRate > 80 ? '#10b981' : '#f59e0b', icon: '📬', sub: `${fmt$(d.totalOutstanding)} outstanding`, tip: 'Percentage of invoiced money actually received.' },
              ].map((s, i) => (
                <motion.div key={s.label} className="stat-card"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <InfoLearnIcon topic={s.key} onLearn={setLearnTopic} tip={s.tip} />
                  </div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>
                    {s.prefix}
                    <CountUp end={s.value} decimals={('decimals' in s ? s.decimals as number : s.prefix === '$' ? 2 : 0)} duration={1.2} separator="," />
                    {'suffix' in s && s.suffix}
                  </div>
                  {s.sub && <div className="stat-sub" style={{ color: ('subColor' in s ? s.subColor as string : undefined), marginTop: 4 }}>{s.sub}</div>}
                </motion.div>
              ))}
            </div>

            {/* ══ HEALTH SCORE + FINANCIAL COACH ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Cash Flow Health Score */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Cash Flow Health</h2>
                  <span style={{ padding: '3px 10px', borderRadius: 99, background: `${d.hcolor}18`, color: d.hcolor, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.hlabel}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 18 }}>
                  <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                    <svg viewBox="0 0 90 90" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <circle cx="45" cy="45" r="37" fill="none" stroke="var(--bg3)" strokeWidth="8" />
                      <motion.circle cx="45" cy="45" r="37" fill="none" stroke={d.hcolor} strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 37}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 37 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 37 * (1 - d.hs / 100) }}
                        transition={{ duration: 1.3, ease: 'easeOut' }} strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: d.hcolor, letterSpacing: '-0.04em', lineHeight: 1 }}><CountUp end={d.hs} duration={1.3} /></span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {[
                      { label: 'Net Position',    val: d.netCash >= 0 ? 'Positive' : 'Negative', color: d.netCash >= 0 ? '#10b981' : '#ef4444' },
                      { label: 'Runway',          val: `${d.cashRunway.toFixed(1)} months`,       color: d.cashRunway > 3 ? '#10b981' : '#f59e0b' },
                      { label: 'Revenue Trend',   val: `${d.incGrowthPct >= 0 ? '+' : ''}${d.incGrowthPct.toFixed(0)}% MoM`, color: d.incGrowthPct >= 0 ? '#10b981' : '#ef4444' },
                      { label: 'Collection Rate', val: `${d.collectionRate.toFixed(0)}%`,          color: d.collectionRate > 80 ? '#10b981' : '#f59e0b' },
                      { label: 'Overdue Risk',    val: d.overdueAmt > 0 ? fmt$(d.overdueAmt, 0) : 'None', color: d.overdueAmt > 0 ? '#f59e0b' : '#10b981' },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                        <span style={{ fontSize: 11, color: 'var(--mu)' }}>{f.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: f.color }}>{f.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Financial Coach */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 320px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Cash Flow Coach</h2>
                  <div className="live-dot" />
                </div>
                {coach.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>💡</span>
                    <p style={{ fontSize: 12 }}>Add more data to unlock intelligent cash flow insights.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {coach.map((c, i) => (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', borderLeft: `3px solid ${c.priority === 'high' ? '#ef4444' : c.priority === 'medium' ? '#f59e0b' : '#10b981'}` }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span style={{ fontSize: 15, flexShrink: 0 }}>{c.icon}</span>
                          <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.55 }}>{c.msg}</p>
                        </div>
                        {c.action && <button onClick={() => router.push('/invoices')} style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0 23px' }}>{c.action} →</button>}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ══ MAIN CHART ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Cash Flow Chart</h2>
                  <InfoLearnIcon topic="forecast" onLearn={setLearnTopic} tip="Income vs expenses over the selected period." />
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {(['30d','60d','90d','6m','12m','all'] as Range[]).map(r => (
                    <button key={r} onClick={() => setRange(r)}
                      style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, background: range === r ? '#6366f1' : 'var(--bg3)', color: range === r ? '#fff' : 'var(--mu)', transition: 'all 0.15s', minHeight: 30 }}>
                      {r === 'all' ? 'All' : r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {chartData.every(r => r.income === 0 && r.expenses === 0) ? (
                <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--mu)' }}>
                  <span style={{ fontSize: 32, marginBottom: 10 }}>📊</span>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>No data for this period</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff7043" stopOpacity={0.18} /><stop offset="95%" stopColor="#ff7043" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="income"   name="Cash In"  stroke="#10b981" strokeWidth={2.5} fill="url(#gI)" dot={false} activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="expenses" name="Cash Out" stroke="#ff7043" strokeWidth={2} fill="url(#gE)" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* ══ FORECAST (30/60/90) ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Forecast Engine</h2>
                <InfoLearnIcon topic="forecast" onLearn={setLearnTopic} tip="Projected income and expenses based on your 3-month average." />
              </div>
              {d.avgInc === 0 && d.avgExp === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px', color: 'var(--mu)' }}>
                  <p style={{ fontSize: 12 }}>Add at least 3 months of income and expenses to unlock forecasting.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  {[
                    { label: 'Next 30 Days', inc: d.avgInc * (1 + d.trendFactor),       exp: d.avgExp,       conf: 'High' },
                    { label: 'Next 60 Days', inc: d.avgInc * (1 + d.trendFactor) * 2,   exp: d.avgExp * 2,   conf: 'Medium' },
                    { label: 'Next 90 Days', inc: d.avgInc * (1 + d.trendFactor) * 3,   exp: d.avgExp * 3,   conf: 'Low' },
                  ].map(f => {
                    const net = f.inc - f.exp
                    return (
                      <div key={f.label} style={{ padding: '16px', borderRadius: 14, background: 'var(--bg3)', border: `1px solid ${net >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu2)' }}>{f.label}</p>
                          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'var(--bg4)', color: 'var(--mu)', fontWeight: 700 }}>Confidence: {f.conf}</span>
                        </div>
                        <p style={{ fontSize: 22, fontWeight: 900, color: net >= 0 ? '#10b981' : '#ef4444', fontFamily: "DM Mono, monospace", letterSpacing: '-0.03em', marginBottom: 10 }}>
                          {net >= 0 ? '+' : ''}{fmt$(net, 0)}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'var(--mu)' }}>Expected In</span>
                            <span style={{ fontWeight: 700, color: '#10b981', fontFamily: "DM Mono, monospace" }}>{fmt$(f.inc, 0)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'var(--mu)' }}>Expected Out</span>
                            <span style={{ fontWeight: 700, color: '#ff7043', fontFamily: "DM Mono, monospace" }}>{fmt$(f.exp, 0)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>

            {/* ══ CASH FLOW TIMELINE ══ */}
            <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Cash Flow Timeline</h2>
                <button onClick={() => setShowFullTimeline(s => !s)} style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showFullTimeline ? 'Show less' : `View all ${timeline.length}`}
                </button>
              </div>
              {timeline.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--mu)' }}><p style={{ fontSize: 12 }}>No transactions yet. Add income and expenses to build your timeline.</p></div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  {(showFullTimeline ? timeline : timeline.slice(0, 12)).map((ev, i) => {
                    const isUpcoming = ev.status === 'upcoming'
                    const isToday    = Math.abs(ev.date.getTime() - Date.now()) < 86400000
                    return (
                      <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 24px', borderBottom: i < (showFullTimeline ? timeline : timeline.slice(0, 12)).length - 1 ? '1px solid var(--bd)' : 'none', opacity: isUpcoming ? 0.8 : 1, transition: 'background 0.12s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${ev.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{ev.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                            <span style={{ fontSize: 10, color: 'var(--mu)' }}>
                              {isUpcoming ? `Due ${ev.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ev.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {isUpcoming && <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 99, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 800 }}>UPCOMING</span>}
                            {ev.status === 'overdue' && <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 99, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 800 }}>OVERDUE</span>}
                            {isToday && <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 99, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 800 }}>TODAY</span>}
                          </div>
                        </div>
                        <p style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, fontSize: 13, color: ev.amount >= 0 ? '#10b981' : '#ff7043', flexShrink: 0 }}>
                          {ev.amount >= 0 ? '+' : ''}{fmt$(Math.abs(ev.amount))}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>

            {/* ══ UPCOMING OBLIGATIONS + INVOICE IMPACT ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Upcoming Obligations */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Upcoming Obligations</h2>
                  <InfoLearnIcon topic="obligations" onLearn={setLearnTopic} tip="Payments your business is expected to make soon." />
                </div>
                {d.subsObligations.length === 0 && d.taxDeadlines.length === 0 && d.invoiceObligations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📋</span>
                    <p style={{ fontSize: 12 }}>No upcoming obligations detected. Mark expenses as subscriptions to track them here.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...d.subsObligations, ...d.invoiceObligations.filter(i => i.isOverdue), ...d.taxDeadlines].slice(0, 6).map((item, i) => {
                      const daysLeft = 'daysUntil' in item ? (item as { daysUntil: number }).daysUntil : Math.round((item.date.getTime() - Date.now()) / 86400000)
                      const isOverdue = daysLeft < 0
                      const urgColor = isOverdue ? '#ef4444' : daysLeft < 7 ? '#f59e0b' : '#10b981'
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)' }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{item.label}</p>
                            <p style={{ fontSize: 10, color: urgColor, fontWeight: 700, marginTop: 2 }}>
                              {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : `In ${daysLeft}d`}
                            </p>
                          </div>
                          {item.amount > 0 && <p style={{ fontSize: 13, fontWeight: 700, color: '#ff7043', fontFamily: "DM Mono, monospace" }}>{fmt$(item.amount)}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>

              {/* Invoice Impact */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.53 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 14 }}>Invoice Impact</h2>
                {d.unpaid.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>✅</span>
                    <p style={{ fontSize: 12 }}>All invoices paid. Excellent collection rate.</p>
                    <button className="btn-ghost" style={{ marginTop: 12, fontSize: 11 }} onClick={() => router.push('/invoices')}>Create Invoice →</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      {[
                        { label: 'Total Outstanding', val: fmt$(d.totalOutstanding), color: '#f59e0b' },
                        { label: 'Overdue',           val: fmt$(d.overdueAmt),       color: '#ef4444' },
                        { label: 'Unpaid Invoices',   val: String(d.unpaid.length),  color: '#0ea5e9' },
                        { label: 'Collection Rate',   val: `${d.collectionRate.toFixed(0)}%`, color: d.collectionRate > 80 ? '#10b981' : '#f59e0b' },
                      ].map(s => (
                        <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)' }}>
                          <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 3 }}>{s.label}</p>
                          <p style={{ fontSize: 15, fontWeight: 900, color: s.color, fontFamily: "DM Mono, monospace" }}>{s.val}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => router.push('/invoices')}>View Invoices →</button>
                      <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => toast.success('Reminder sent to all overdue clients 📨')}>Send Reminders</button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>

            {/* ══ SUBSCRIPTION DRAIN + CASH LEAKS ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Subscription Drain */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Subscription Drain</h2>
                    <InfoLearnIcon topic="subscriptions" onLearn={setLearnTopic} tip="Recurring charges that automatically leave your account." />
                  </div>
                  {d.subMonthlyTotal > 0 && <p style={{ fontSize: 13, fontWeight: 900, color: '#f59e0b', fontFamily: "DM Mono, monospace" }}>{fmt$(d.subMonthlyTotal)}/mo</p>}
                </div>
                {d.subs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📱</span>
                    <p style={{ fontSize: 12 }}>No recurring expenses detected.</p>
                  </div>
                ) : (
                  <>
                    {d.subs.slice(0, 5).map(s => (
                      <div key={s.vendor} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{s.vendor}</p>
                          <p style={{ fontSize: 10, color: 'var(--mu)' }}>{s.cat} · {s.months} months</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#ff7043', fontFamily: "DM Mono, monospace" }}>{fmt$(s.monthlyAvg)}/mo</p>
                          <p style={{ fontSize: 9, color: 'var(--mu2)' }}>{fmt$(s.monthlyAvg * 12, 0)}/yr</p>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, color: 'var(--ink)' }}>
                      💡 Annual total: <strong>{fmt$(d.subMonthlyTotal * 12, 0)}</strong>. Audit for unused services.
                    </div>
                  </>
                )}
              </motion.div>

              {/* Cash Leak Detector */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.59 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 14 }}>Cash Leak Detector</h2>
                {d.leaks.length === 0 && d.overdueAmt === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>🔍</span>
                    <p style={{ fontSize: 12 }}>No cash leaks detected. Your spending looks consistent.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.leaks.map(l => (
                      <div key={l.cat} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', borderLeft: '3px solid #f59e0b' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{l.cat} spending +{l.growth.toFixed(0)}%</p>
                        <p style={{ fontSize: 11, color: 'var(--mu)' }}>{fmt$(l.curr)} this month vs {fmt$(l.prev)} last month.</p>
                      </div>
                    ))}
                    {d.overdueAmt > 0 && (
                      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', borderLeft: '3px solid #ef4444' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Overdue invoices costing you cash</p>
                        <p style={{ fontSize: 11, color: 'var(--mu)' }}>{fmt$(d.overdueAmt)} overdue could be recovered now.</p>
                        <button onClick={() => router.push('/invoices')} style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0' }}>Follow up →</button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ══ WHAT-IF SIMULATOR ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>What-If Simulator</h2>
                <InfoLearnIcon topic="whatIf" onLearn={setLearnTopic} tip="Model decisions before making them. See how they affect your runway." />
              </div>
              <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 16 }}>Select a scenario to see how it affects your runway and cash position.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {([
                  { id: 'rev-drop-10' as WhatIfId,  label: 'Revenue −10%',         icon: '📉' },
                  { id: 'rev-drop-20' as WhatIfId,  label: 'Revenue −20%',         icon: '📉' },
                  { id: 'add-500-exp' as WhatIfId,  label: '+$500/mo expense',     icon: '💸' },
                  { id: 'add-2k-exp' as WhatIfId,   label: '+$2,000/mo expense',   icon: '💸' },
                  { id: 'collect-overdue' as WhatIfId, label: 'Collect all overdue', icon: '💰' },
                  { id: 'lose-top' as WhatIfId,     label: `Lose ${d.topClientName.split(' ')[0]}`, icon: '👋' },
                  { id: 'custom' as WhatIfId,       label: 'Custom',               icon: '⚙️' },
                ]).map(s => (
                  <button key={s.id} onClick={() => setWhatIfId(whatIfId === s.id ? null : s.id)}
                    style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${whatIfId === s.id ? '#6366f1' : 'var(--bd)'}`, background: whatIfId === s.id ? 'rgba(99,102,241,0.1)' : 'var(--bg3)', cursor: 'pointer', fontSize: 12, fontWeight: whatIfId === s.id ? 700 : 500, color: whatIfId === s.id ? '#6366f1' : 'var(--ink)', transition: 'all 0.15s', minHeight: 44 }}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>

              {whatIfId === 'custom' && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', marginBottom: 5 }}>Type</p>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['income','expense'] as const).map(t => (
                        <button key={t} onClick={() => setCustomWhatIfType(t)}
                          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: customWhatIfType === t ? '#6366f1' : 'var(--bg3)', color: customWhatIfType === t ? '#fff' : 'var(--mu)', minHeight: 36 }}>
                          {t === 'income' ? '+ Income' : '+ Expense'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', marginBottom: 5 }}>Monthly Amount</p>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 13 }}>$</span>
                      <input type="number" min="0" value={customWhatIfAmt} onChange={e => setCustomWhatIfAmt(e.target.value)}
                        placeholder="500"
                        style={{ width: 120, padding: '8px 10px 8px 24px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 9, fontSize: 13, color: 'var(--in-txt)', outline: 'none' }} />
                    </div>
                  </div>
                </div>
              )}

              <AnimatePresence>
                {whatIfResult && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--bg3)', border: `1.5px solid ${whatIfResult.riskColor}33` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 14 }}>
                      {[
                        { label: 'Runway Before', val: `${whatIfResult.runwayBefore.toFixed(1)} mo`, color: 'var(--ink)' },
                        { label: 'Runway After',  val: `${whatIfResult.runwayAfter.toFixed(1)} mo`, color: whatIfResult.riskColor },
                        { label: 'Change',        val: `${whatIfResult.runwayDelta >= 0 ? '+' : ''}${whatIfResult.runwayDelta.toFixed(1)} mo`, color: whatIfResult.runwayDelta >= 0 ? '#10b981' : '#ef4444' },
                        { label: 'Risk Level',    val: whatIfResult.riskLabel, color: whatIfResult.riskColor },
                      ].map(r => (
                        <div key={r.label} style={{ textAlign: 'center', padding: '12px', borderRadius: 10, background: 'var(--bg2)' }}>
                          <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu2)', marginBottom: 6 }}>{r.label}</p>
                          <p style={{ fontSize: 18, fontWeight: 900, color: r.color, fontFamily: "DM Mono, monospace", letterSpacing: '-0.03em' }}>{r.val}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setWhatIfId(null); setCustomWhatIfAmt('') }} className="btn-ghost" style={{ fontSize: 12 }}>Reset</button>
                      <button onClick={() => toast.success('Scenario noted! Adjust your budget accordingly.')} className="btn-ghost" style={{ fontSize: 12 }}>Save Scenario</button>
                      <button onClick={() => setLearnTopic('whatIf')} style={{ fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Learn More →</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}

        <style>{`
          .cf-fab { display: none; }
          @media (max-width: 767px) {
            .cf-fab { display: flex; position: fixed; bottom: 80px; right: 20px; z-index: 50; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#8b5cf6); border: none; cursor: pointer; align-items: center; justify-content: center; font-size: 22px; color: #fff; box-shadow: 0 8px 24px rgba(99,102,241,0.4); }
          }
        `}</style>
        <button className="cf-fab" onClick={() => setDrawerMode('income')}>+</button>
      </motion.div>

      {/* ══ DRAWERS & MODALS ══ */}
      <QuickAddIncomeDrawer open={drawerMode === 'income'} onClose={() => setDrawerMode(null)} userId={userId}
        onSaved={item => { setIncomeData(prev => [item, ...prev]); setDrawerMode(null) }} />
      <QuickAddExpenseDrawer open={drawerMode === 'expense'} onClose={() => setDrawerMode(null)} userId={userId}
        onSaved={item => { setExpenseData(prev => [item, ...prev]); setDrawerMode(null) }} />
      <ConnectBankModal open={drawerMode === 'bank'} onClose={() => setDrawerMode(null)} userId={userId}
        onBalanceSaved={b => { setCashBalances(prev => [b, ...prev]); setDrawerMode(null) }} />
      <LearnDrawer topic={learnTopic} onClose={() => setLearnTopic(null)} />
    </div>
  )
}
