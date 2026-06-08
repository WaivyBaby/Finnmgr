'use client'
/*
 * INCOME COMMAND CENTER
 * Migration: supabase/migrations/income_command_center.sql
 * All analytics from real Supabase data. No mock data. No fake AI.
 * Font names with spaces: always template literals or double quotes, never single-quoted strings.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import CountUp from 'react-countup'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Income = {
  id: string; date: string; amount: number; client_name?: string
  category: string; payment_method?: string; status: string; notes?: string
  is_recurring?: boolean; recurrence_period?: string; invoice_ref?: string
  income_type?: string; user_id?: string
}
type Expense  = { id: string; date: string; amount: number; category: string }
type Invoice  = {
  id: string; invoice_number: string; status: string; total?: number
  balance_due?: number; client_name: string; due_date?: string; created_at: string
}
type Client   = { id: string; name: string; created_at: string }
type Tab      = 'overview' | '7d' | '30d' | '90d' | '1y' | 'all'
type Metric   = 'revenue' | 'profit' | 'outstanding'
type GoalStore = { monthly: number; quarterly: number; annual: number }

/* ─── Constants ──────────────────────────────────────────────────────────── */
const CATEGORIES  = ['Design','Development','Consulting','Photography','Retainer','E-commerce','Coaching','Writing','Marketing','Other']
const INCOME_TYPES = ['Service','Product','Subscription','Consulting','Retainer','Commission','Other']
const METHODS     = ['Bank Transfer','Stripe','PayPal','Check','Cash','Venmo','Zelle','Other']
const RECURRENCE  = ['monthly','quarterly','annual']
const CAT_COLORS  = ['#6366f1','#10b981','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#ff7043','#14b8a6','#64748b']
const GOALS_KEY   = 'finnmgr_income_goals_v2'
const TAX_RATE    = 0.25

const DEFAULT_FORM = {
  date: new Date().toISOString().split('T')[0],
  amount: '', client_name: '', category: 'Design', income_type: 'Service',
  payment_method: 'Bank Transfer', status: 'received', notes: '',
  is_recurring: false, recurrence_period: 'monthly', invoice_ref: '',
}

/* ─── Learn content ──────────────────────────────────────────────────────── */
const LEARN: Record<string, { title: string; short: string; body: string; tips: string[] }> = {
  revenue: {
    title: 'Revenue',
    short: 'Money your business earned in this period before expenses.',
    body: 'Revenue is the total amount of income recorded for the selected time period — received and pending. It does not account for expenses. Use it alongside profit margin to understand true business performance.',
    tips: ['Track monthly to spot seasonal trends', 'Compare to the previous period to measure growth', 'Set a monthly target to stay accountable'],
  },
  health: {
    title: 'Revenue Health',
    short: 'A 0–100 score measuring revenue quality across 5 factors.',
    body: 'Revenue Health combines: revenue growth trend, client diversity (no single client >60%), invoice collection rate, cash flow stability, and profit margin. Score 70+ = Excellent, 45–69 = Good, below 45 = Needs Attention.',
    tips: ['Diversify clients — no single client should exceed 30% of revenue', 'Follow up on overdue invoices within 7 days', 'Track profit margin alongside revenue'],
  },
  outstanding: {
    title: 'Outstanding Revenue',
    short: "Money you've invoiced but haven't received yet.",
    body: 'Outstanding revenue is the total balance due across unpaid invoices (Sent, Viewed, Partial, Overdue). This money is earned but not yet in your bank account. Prompt follow-up significantly improves collection.',
    tips: ['Follow up at 7, 14, and 30 days past due', 'Offer a 2% discount for payment within 10 days', 'Require a 50% deposit on new projects over $1,000'],
  },
  projected: {
    title: 'Projected Month End',
    short: 'Estimated revenue by month-end based on current daily rate.',
    body: "Projected Month End divides your current month's revenue by days elapsed and multiplies by days in the month. It's a straight-line estimate — useful for tracking pace but not a guarantee.",
    tips: ['Compare projection against your monthly goal', 'A projection below goal mid-month = act now', 'Factor in known upcoming payments for accuracy'],
  },
  goal: {
    title: 'Revenue Goal',
    short: 'How close you are to your monthly revenue target.',
    body: 'Revenue Goal tracks your current month progress toward a self-set monthly target. Goals are stored locally on your device. Setting specific targets has been shown to improve performance by 15–20%.',
    tips: ['Set goals 10–20% above last period for stretch targets', 'Break annual goals into monthly milestones', 'Review and adjust goals quarterly'],
  },
  trend: {
    title: 'Revenue Trend',
    short: 'Your income over time — spot growth, decline, and seasonality.',
    body: 'The Revenue Trend chart shows income bucketed by the selected time range. Toggle to Profit (income minus expenses) or Outstanding (unpaid invoice balances generated in each period). Use this to identify seasonal patterns and growth trajectory.',
    tips: ['Two consecutive declining months = investigate pipeline', 'Revenue in the same month dips year-over-year = seasonality', 'Compare current trend to the same period last year'],
  },
  insights: {
    title: 'Revenue Insights',
    short: 'Automatic analysis of your revenue data.',
    body: 'Revenue Insights applies rule-based analysis to your actual income, invoice, and client data to surface patterns, risks, and opportunities. Every insight is derived from your records — not guesswork.',
    tips: ['Act on high-priority (red) insights this week', 'Yellow insights = monitor closely', 'Green insights = reinforce what is working'],
  },
  clients: {
    title: 'Top Revenue Clients',
    short: 'Your highest-earning clients ranked by income generated.',
    body: 'Top Clients shows which clients generate the most revenue in the selected period. Concentration risk occurs when a single client represents more than 50% of revenue — losing that client creates a critical cash flow event.',
    tips: ['Keep any single client below 30% of total revenue', 'Proactively check in with top clients quarterly', 'Identify upsell opportunities with repeat clients'],
  },
  categories: {
    title: 'Revenue by Category',
    short: 'Which service types generate the most income.',
    body: "Category breakdown shows which types of work generate the most revenue. Use this to identify your highest-value services, decide where to focus sales efforts, and price work accurately.",
    tips: ['Double down on your highest-revenue category', 'Consider retiring low-revenue categories', 'Raise prices in your top category by 10–15% annually'],
  },
  opportunities: {
    title: 'Revenue Opportunities',
    short: 'Specific actionable revenue you may be missing.',
    body: 'Revenue Opportunities detects clients who previously generated income but have gone quiet, expected recurring payments that have not arrived, and outstanding invoices ready to follow up on.',
    tips: ['Follow up on opportunities within 48 hours', 'A simple check-in email converts at ~20%', 'Recurring clients are 5× easier to re-engage than new ones'],
  },
}

/* ─── Period helpers ─────────────────────────────────────────────────────── */
function getPeriodDates(tab: Tab): { start: Date; prevStart: Date; prevEnd: Date; label: string } {
  const now = new Date()
  if (tab === 'overview') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start, prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1), prevEnd: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59), label: 'This Month' }
  }
  if (tab === '7d') {
    const s = new Date(now.getTime() - 7 * 86400000)
    return { start: s, prevStart: new Date(now.getTime() - 14 * 86400000), prevEnd: s, label: 'Last 7 Days' }
  }
  if (tab === '30d') {
    const s = new Date(now.getTime() - 30 * 86400000)
    return { start: s, prevStart: new Date(now.getTime() - 60 * 86400000), prevEnd: s, label: 'Last 30 Days' }
  }
  if (tab === '90d') {
    const s = new Date(now.getTime() - 90 * 86400000)
    return { start: s, prevStart: new Date(now.getTime() - 180 * 86400000), prevEnd: s, label: 'Last 90 Days' }
  }
  if (tab === '1y') {
    const s = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    return { start: s, prevStart: new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()), prevEnd: s, label: 'Last 12 Months' }
  }
  return { start: new Date(0), prevStart: new Date(0), prevEnd: new Date(0), label: 'All Time' }
}

/* ─── Chart data builder ─────────────────────────────────────────────────── */
function buildChartBuckets(
  income: Income[], expenses: Expense[], invoices: Invoice[], tab: Tab, metric: Metric
): { label: string; value: number }[] {
  const now = new Date()

  function revInRange(start: Date, end: Date) {
    return income.filter(x => { const d = new Date(x.date); return d >= start && d <= end }).reduce((s, x) => s + Number(x.amount), 0)
  }
  function expInRange(start: Date, end: Date) {
    return expenses.filter(x => { const d = new Date(x.date); return d >= start && d <= end }).reduce((s, x) => s + Number(x.amount), 0)
  }
  function outInRange(start: Date, end: Date) {
    return invoices.filter(x => {
      const d = new Date(x.created_at)
      return d >= start && d <= end && ['sent','overdue','viewed','partial'].includes(x.status)
    }).reduce((s, x) => s + Math.max(0, Number(x.balance_due ?? x.total ?? 0)), 0)
  }
  function val(s: Date, e: Date) {
    return metric === 'revenue' ? revInRange(s, e) : metric === 'profit' ? revInRange(s, e) - expInRange(s, e) : outInRange(s, e)
  }

  if (tab === 'overview') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return Array.from({ length: now.getDate() }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), i + 1)
      const end = new Date(now.getFullYear(), now.getMonth(), i + 1, 23, 59, 59)
      return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: val(d, end) }
    })
  }
  if (tab === '7d' || tab === '30d') {
    const days = tab === '7d' ? 7 : 30
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (days - 1 - i))
      const end = new Date(d); end.setHours(23, 59, 59)
      const start = new Date(d); start.setHours(0, 0, 0)
      return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: val(start, end) }
    })
  }
  if (tab === '90d') {
    return Array.from({ length: 13 }, (_, i) => {
      const s = new Date(now.getTime() - (12 - i) * 7 * 86400000)
      const e = new Date(now.getTime() - (11 - i) * 7 * 86400000)
      return { label: s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: val(s, e) }
    })
  }
  const months = tab === '1y' ? 12 : (() => {
    const dates = income.map(x => x.date)
    if (!dates.length) return 6
    const e = new Date(Math.min(...dates.map(d => new Date(d).getTime())))
    return Math.max((now.getFullYear() - e.getFullYear()) * 12 + (now.getMonth() - e.getMonth()) + 1, 1)
  })()
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    return { label: d.toLocaleString('default', { month: 'short', year: '2-digit' }), value: val(d, e) }
  })
}

/* ─── Formatting ─────────────────────────────────────────────────────────── */
function fmt$(n: number, dec = 2) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}

/* ─── Chart tooltip ──────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 11 }}>
      <p style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: payload[0].color, fontWeight: 700 }}>{fmt$(payload[0].value)}</p>
    </div>
  )
}

/* ─── InfoIcon ───────────────────────────────────────────────────────────── */
function InfoIcon({ topic, short, onLearn }: { topic: string; short: string; onLearn: (t: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 5 }}>
      <button
        type="button"
        aria-label={`Learn about ${topic}`}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); onLearn(topic) }}
        style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--bd2)', color: 'var(--mu)', fontSize: 9, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, lineHeight: 1 }}>
        i
      </button>
      {show && (
        <span role="tooltip" style={{ position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: 'var(--ink)', lineHeight: 1.6, width: 200, zIndex: 99, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', pointerEvents: 'none', whiteSpace: 'normal', fontWeight: 400 }}>
          {short}
          <span style={{ display: 'block', marginTop: 4, color: '#6366f1', fontWeight: 700, fontSize: 10 }}>Click to learn more →</span>
        </span>
      )}
    </span>
  )
}

/* ─── Learn Panel ────────────────────────────────────────────────────────── */
function LearnPanel({ topic, onClose }: { topic: string | null; onClose: () => void }) {
  const content = topic ? LEARN[topic] : null

  useEffect(() => {
    if (!topic) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [topic, onClose])

  return (
    <AnimatePresence>
      {topic && content && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 799 }} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="side-drawer-panel"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
              <h3 style={{ fontWeight: 900, fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{content.title}</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#6366f1', marginBottom: 8 }}>What it means</p>
                <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>{content.body}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#6366f1', marginBottom: 10 }}>Tips</p>
                {content.tips.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#fff', fontWeight: 800 }}>{i + 1}</div>
                    <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Income Drawer (Add / Edit) ─────────────────────────────────────────── */
function IncomeDrawer({
  open, onClose, onSaved, onUpdated, editItem, invoiceList, userId,
}: {
  open: boolean; onClose: () => void
  onSaved: (item: Income) => void
  onUpdated: (item: Income) => void
  editItem: Income | null
  invoiceList: Invoice[]
  userId: string
}) {
  const isEdit = !!editItem
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(isEdit && editItem ? {
      date: editItem.date, amount: String(editItem.amount),
      client_name: editItem.client_name ?? '', category: editItem.category,
      income_type: editItem.income_type ?? 'Service',
      payment_method: editItem.payment_method ?? 'Bank Transfer',
      status: editItem.status, notes: editItem.notes ?? '',
      is_recurring: editItem.is_recurring ?? false,
      recurrence_period: editItem.recurrence_period ?? 'monthly',
      invoice_ref: editItem.invoice_ref ?? '',
    } : { ...DEFAULT_FORM })
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, isEdit, editItem, onClose])

  function linkInvoice(invId: string) {
    const inv = invoiceList.find(i => i.id === invId)
    if (!inv) return
    setForm(f => ({
      ...f,
      client_name: inv.client_name,
      amount: String(inv.balance_due ?? inv.total ?? 0),
      invoice_ref: inv.invoice_number,
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      ...form, amount: parseFloat(form.amount),
      is_recurring: form.is_recurring,
      recurrence_period: form.is_recurring ? form.recurrence_period : null,
      invoice_ref: form.invoice_ref || null,
      notes: form.notes || null,
      income_type: form.income_type || null,
    }
    if (isEdit && editItem) {
      const { data, error } = await sb.from('income').update(payload).eq('id', editItem.id).select().single()
      setSaving(false)
      if (error) { toast.error('Failed to save'); return }
      toast.success('Income updated ✓')
      onUpdated(data as Income); onClose()
    } else {
      const { data, error } = await sb.from('income').insert({ user_id: userId, ...payload }).select().single()
      setSaving(false)
      if (error) { toast.error('Failed to add income'); return }
      toast.success('Income added ✓')
      onSaved(data as Income); onClose()
    }
  }

  const iStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }
  const lStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block' }

  const unpaidInvoices = invoiceList.filter(i => ['sent','overdue','viewed','partial'].includes(i.status))

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 799 }} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="side-drawer-panel"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
              <div>
                <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{isEdit ? 'Edit Income' : 'Record Income'}</h3>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{isEdit ? 'Update this income record.' : 'Record a new income transaction.'}</p>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {/* Form */}
            <form onSubmit={submit} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Link invoice */}
              {!isEdit && unpaidInvoices.length > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <label style={lStyle}>Link to Invoice (auto-fills amount)</label>
                  <select style={iStyle} defaultValue="" onChange={e => e.target.value && linkInvoice(e.target.value)}>
                    <option value="">Select an outstanding invoice…</option>
                    {unpaidInvoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} — {inv.client_name} ({fmt$(Number(inv.balance_due ?? inv.total ?? 0))})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Client / Source</label>
                  <input style={iStyle} placeholder="Acme Corp" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
                </div>
                <div>
                  <label style={lStyle}>Amount ($) *</label>
                  <div style={{ position: 'relative', marginTop: 6 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 14 }}>$</span>
                    <input style={{ ...iStyle, marginTop: 0, paddingLeft: 26 }} type="number" min="0" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label style={lStyle}>Date *</label>
                  <input style={iStyle} type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label style={lStyle}>Category</label>
                  <select style={iStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Income Type</label>
                  <select style={iStyle} value={form.income_type} onChange={e => setForm(f => ({ ...f, income_type: e.target.value }))}>
                    {INCOME_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Payment Method</label>
                  <select style={iStyle} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                    {METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Status</label>
                  <select style={iStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="received">Received</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Invoice Reference (optional)</label>
                  <input style={iStyle} placeholder="INV-001" value={form.invoice_ref} onChange={e => setForm(f => ({ ...f, invoice_ref: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Notes (optional)</label>
                  <textarea style={{ ...iStyle, height: 72, resize: 'none', lineHeight: 1.6 }} placeholder="Project details, PO number, etc." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1', display: 'flex', gap: 20, alignItems: 'center', padding: '10px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)', minHeight: 44 }}>
                    <input type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} />
                    Recurring income
                  </label>
                  {form.is_recurring && (
                    <select style={{ ...iStyle, marginTop: 0, width: 'auto' }} value={form.recurrence_period} onChange={e => setForm(f => ({ ...f, recurrence_period: e.target.value }))}>
                      {RECURRENCE.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 10 }}>
              <button onClick={submit as unknown as React.MouseEventHandler} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '13px 20px', fontSize: 14 }}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Record Income'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '13px 20px' }}>Cancel</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   INCOME COMMAND CENTER — MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function IncomePage() {
  const router = useRouter()

  /* ── Data ── */
  const [income, setIncome]     = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients]   = useState<Client[]>([])
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState('')

  /* ── UI ── */
  const [activeTab, setActiveTab]   = useState<Tab>('overview')
  const [chartMetric, setChartMetric] = useState<Metric>('revenue')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editItem, setEditItem]     = useState<Income | null>(null)
  const [learnTopic, setLearnTopic] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [search, setSearch]         = useState('')
  const [showAll, setShowAll]       = useState(false)
  const [goals, setGoals]           = useState<GoalStore>({ monthly: 0, quarterly: 0, annual: 0 })
  const [goalDraft, setGoalDraft]   = useState<GoalStore>({ monthly: 0, quarterly: 0, annual: 0 })
  const [editGoals, setEditGoals]   = useState(false)

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [incRes, expRes, invRes, cliRes] = await Promise.all([
      sb.from('income').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      sb.from('expenses').select('id,date,amount,category').eq('user_id', user.id),
      sb.from('invoices').select('id,invoice_number,status,total,balance_due,client_name,due_date,created_at').eq('user_id', user.id),
      sb.from('clients').select('id,name,created_at').eq('user_id', user.id).is('archived_at', null),
    ])
    setIncome(incRes.data ?? [])
    setExpenses(expRes.data ?? [])
    setInvoices(invRes.data ?? [])
    setClients(cliRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Goals ── */
  useEffect(() => {
    try { const s = localStorage.getItem(GOALS_KEY); if (s) { const g = JSON.parse(s); setGoals(g); setGoalDraft(g) } } catch {}
  }, [])

  function saveGoals() {
    setGoals(goalDraft)
    try { localStorage.setItem(GOALS_KEY, JSON.stringify(goalDraft)) } catch {}
    setEditGoals(false)
    toast.success('Goals saved ✓')
  }

  /* ── CRUD ── */
  async function remove(id: string) {
    const sb = createClient()
    await sb.from('income').delete().eq('id', id)
    setIncome(prev => prev.filter(i => i.id !== id))
    toast.success('Removed')
  }

  /* ── Export ── */
  function exportCsv(rows: Record<string, unknown>[], filename: string) {
    if (!rows.length) { toast.error('No data to export'); return }
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = filename; a.click()
    toast.success(`${filename} exported ✓`)
    setExportOpen(false)
  }

  const exportAll   = () => exportCsv(income.map(i => ({ date: i.date, client: i.client_name || '', amount: i.amount, category: i.category, type: i.income_type || '', status: i.status, recurring: !!i.is_recurring, notes: i.notes || '' })), 'income_all.csv')
  const exportMonth = () => { const now = new Date(); exportCsv(income.filter(i => { const d = new Date(i.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() }).map(i => ({ date: i.date, client: i.client_name || '', amount: i.amount, category: i.category, status: i.status })), `income_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}.csv`) }
  const exportYear  = () => { const yr = new Date().getFullYear(); exportCsv(income.filter(i => new Date(i.date).getFullYear() === yr).map(i => ({ date: i.date, client: i.client_name || '', amount: i.amount, category: i.category })), `income_${yr}.csv`) }
  const exportPnL   = () => { const rows = [...income.map(i => ({ type: 'income', date: i.date, desc: i.client_name || i.category, amount: i.amount })), ...expenses.map(e => ({ type: 'expense', date: e.date, desc: e.category, amount: -e.amount }))].sort((a,b) => a.date.localeCompare(b.date)); exportCsv(rows, 'profit_loss.csv') }
  const exportTax   = () => { const yr = new Date().getFullYear(); exportCsv(income.filter(i => new Date(i.date).getFullYear() === yr).map(i => ({ date: i.date, client: i.client_name || '', amount: i.amount, category: i.category })), `tax_income_${yr}.csv`) }

  /* ════════════════════════════════════════════════════════════════════
     CENTRALISED COMPUTED DATA
  ════════════════════════════════════════════════════════════════════ */
  const d = useMemo(() => {
    const now      = new Date()
    const { start: periodStart, prevStart, prevEnd, label: periodLabel } = getPeriodDates(activeTab)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    /* ── Period-filtered income (for KPI 1 + chart + insights) ── */
    const periodIncome = income.filter(i => new Date(i.date) >= periodStart)
    const prevIncome   = income.filter(i => { const d = new Date(i.date); return d >= prevStart && d < (activeTab === 'all' ? prevEnd : periodStart) })
    const periodRevenue   = periodIncome.reduce((s, i) => s + Number(i.amount), 0)
    const prevRevenue     = prevIncome.reduce((s, i) => s + Number(i.amount), 0)
    const growthPct       = prevRevenue > 0 ? ((periodRevenue - prevRevenue) / prevRevenue) * 100 : periodRevenue > 0 ? 100 : 0

    /* ── Current-state (always this month / now) ── */
    const currentMonthIncome = income.filter(i => new Date(i.date) >= monthStart)
    const currentMonthRevenue = currentMonthIncome.reduce((s, i) => s + Number(i.amount), 0)
    const totalRevenue        = income.reduce((s, i) => s + Number(i.amount), 0)

    /* ── Projected month end ── */
    const daysElapsed   = now.getDate()
    const daysInMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const projectedMonthEnd = daysElapsed > 0 ? (currentMonthRevenue / daysElapsed) * daysInMonth : 0

    /* ── Outstanding (from invoices) ── */
    const unpaidInvoices  = invoices.filter(i => ['sent','overdue','viewed','partial'].includes(i.status))
    const overdueInvoices = invoices.filter(i => i.status === 'overdue')
    const totalOutstanding = unpaidInvoices.reduce((s, i) => s + Math.max(0, Number(i.balance_due ?? i.total ?? 0)), 0)

    /* ── Expenses (for profit calc) ── */
    const totalExpenses        = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const currentMonthExpenses = expenses.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + Number(e.amount), 0)

    /* ── Revenue Health Score ── */
    let healthScore = 60
    if (growthPct > 15)  healthScore += 12
    else if (growthPct > 5) healthScore += 6
    else if (growthPct < -15) healthScore -= 15
    else if (growthPct < -5)  healthScore -= 8

    const totalPaidInv    = invoices.filter(i => i.status === 'paid').length
    const totalSentInv    = invoices.filter(i => i.status !== 'draft').length
    const collectionRate  = totalSentInv > 0 ? totalPaidInv / totalSentInv : 1
    if (collectionRate > 0.9) healthScore += 8
    else if (collectionRate < 0.6) healthScore -= 12

    const clientRev: Record<string, number> = {}
    income.forEach(i => { if (i.client_name) clientRev[i.client_name] = (clientRev[i.client_name] ?? 0) + Number(i.amount) })
    const topConcentration = totalRevenue > 0 && Object.values(clientRev).length > 0
      ? Math.max(...Object.values(clientRev)) / totalRevenue * 100 : 0
    if (topConcentration > 70) healthScore -= 15
    else if (topConcentration > 50) healthScore -= 8
    else if (topConcentration < 30 && Object.keys(clientRev).length >= 3) healthScore += 5

    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0
    if (profitMargin > 40) healthScore += 8
    else if (profitMargin < 10 && income.length > 2) healthScore -= 10

    if (overdueInvoices.length > 0) healthScore -= Math.min(15, overdueInvoices.length * 5)

    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))
    const healthLabel = healthScore >= 70 ? 'Excellent' : healthScore >= 45 ? 'Good' : 'Needs Attention'
    const healthColor = healthScore >= 70 ? '#10b981' : healthScore >= 45 ? '#0ea5e9' : '#f59e0b'

    /* ── Categories (period-filtered) ── */
    const catRev: Record<string, number> = {}
    periodIncome.forEach(i => { catRev[i.category] = (catRev[i.category] ?? 0) + Number(i.amount) })
    const topCategories = Object.entries(catRev)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt], idx) => ({ cat, amt, pct: periodRevenue > 0 ? amt / periodRevenue * 100 : 0, color: CAT_COLORS[idx % CAT_COLORS.length] }))

    /* ── Top clients (period-filtered) ── */
    const cliRevPeriod: Record<string, number> = {}
    periodIncome.forEach(i => { if (i.client_name) cliRevPeriod[i.client_name] = (cliRevPeriod[i.client_name] ?? 0) + Number(i.amount) })
    const topClients = Object.entries(cliRevPeriod)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, rev]) => ({ name, rev, pct: periodRevenue > 0 ? rev / periodRevenue * 100 : 0 }))

    /* ── Best month ── */
    const monthTotals: Record<string, number> = {}
    income.forEach(i => {
      const k = new Date(i.date).toLocaleString('default', { month: 'long', year: 'numeric' })
      monthTotals[k] = (monthTotals[k] ?? 0) + Number(i.amount)
    })
    const bestMonth = Object.entries(monthTotals).sort((a, b) => b[1] - a[1])[0]

    /* ── Monthly trend for decline detection ── */
    const last3 = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      return income.filter(x => { const xd = new Date(x.date); return xd >= d && xd <= end }).reduce((s, x) => s + Number(x.amount), 0)
    })
    const decliningTwoMonths = last3[0] < last3[1] && last3[1] < last3[2] && last3[2] > 0

    /* ── Revenue Opportunities ── */
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const prevMonthClients = new Set(income.filter(i => { const d = new Date(i.date); return d >= prevMonthStart && d <= prevMonthEnd && i.client_name }).map(i => i.client_name!))
    const thisMonthClients = new Set(income.filter(i => new Date(i.date) >= monthStart && i.client_name).map(i => i.client_name!))
    const missingThisMonth = [...prevMonthClients].filter(c => !thisMonthClients.has(c))
    const missingAmounts   = Object.fromEntries(missingThisMonth.map(c => [c, income.filter(i => { const d = new Date(i.date); return d >= prevMonthStart && d <= prevMonthEnd && i.client_name === c }).reduce((s, i) => s + Number(i.amount), 0)]))

    const recurringMissing = income.filter(i => i.is_recurring && i.recurrence_period === 'monthly' && new Date(i.date) < monthStart).filter(i => !income.some(x => x.client_name === i.client_name && x.is_recurring && new Date(x.date) >= monthStart))

    /* ── Tax estimate ── */
    const estimatedTax = Math.max(0, (totalRevenue - totalExpenses) * TAX_RATE)

    return {
      periodRevenue, prevRevenue, growthPct, periodIncome, periodLabel,
      currentMonthRevenue, totalRevenue,
      projectedMonthEnd, daysElapsed, daysInMonth,
      totalOutstanding, unpaidCount: unpaidInvoices.length, overdueCount: overdueInvoices.length,
      healthScore, healthLabel, healthColor, collectionRate, profitMargin,
      topCategories, topClients, topConcentration,
      bestMonth, decliningTwoMonths,
      missingThisMonth, missingAmounts, recurringMissing,
      totalExpenses, currentMonthExpenses, estimatedTax,
      clientRev,
    }
  }, [income, expenses, invoices, clients, activeTab])

  /* ── Revenue Insights (rule-based, from real data) ── */
  const insights = useMemo(() => {
    const list: { icon: string; title: string; msg: string; priority: 'high'|'medium'|'low'; action?: string; onAction?: () => void }[] = []
    if (income.length === 0) return list

    const { growthPct, topClients, topConcentration, totalOutstanding, overdueCount, profitMargin, bestMonth, decliningTwoMonths, estimatedTax, periodLabel, periodRevenue, currentMonthRevenue } = d

    if (decliningTwoMonths)
      list.push({ icon: '📉', title: 'Declining Revenue', msg: `Revenue has declined for 2 consecutive months. Review your pipeline and reach out to inactive clients.`, priority: 'high', action: 'View opportunities', onAction: () => {} })

    if (overdueCount > 0)
      list.push({ icon: '🚨', title: 'Overdue Invoices', msg: `${overdueCount} invoice${overdueCount > 1 ? 's are' : ' is'} overdue. Follow up today — every day delayed reduces collection probability.`, priority: 'high', action: 'View invoices', onAction: () => router.push('/invoices') })

    if (growthPct > 10 && periodRevenue > 0)
      list.push({ icon: '🚀', title: 'Strong Growth', msg: `Revenue grew ${growthPct.toFixed(0)}% vs the previous ${periodLabel.toLowerCase()}. Momentum is building.`, priority: 'low', action: 'View breakdown', onAction: () => {} })
    else if (growthPct < -10 && income.length > 3)
      list.push({ icon: '⚠️', title: 'Revenue Down', msg: `Revenue declined ${Math.abs(growthPct).toFixed(0)}% vs the previous period. Investigate and act before it compounds.`, priority: 'high', action: 'View clients', onAction: () => router.push('/clients') })

    if (topConcentration > 50 && topClients[0])
      list.push({ icon: '🎯', title: 'Concentration Risk', msg: `${topClients[0].name} represents ${topConcentration.toFixed(0)}% of revenue. Losing this client would be a critical cash flow event.`, priority: 'medium', action: 'View client', onAction: () => router.push('/clients') })

    if (bestMonth && bestMonth[0] !== new Date().toLocaleString('default', { month: 'long', year: 'numeric' }) && income.length > 3) {
      const isCurrentBest = currentMonthRevenue >= bestMonth[1]
      if (!isCurrentBest)
        list.push({ icon: '🏆', title: 'Best Month Reference', msg: `Your best month was ${bestMonth[0]} at ${fmt$(bestMonth[1])}. You're at ${fmt$(currentMonthRevenue)} this month — ${((currentMonthRevenue / bestMonth[1]) * 100).toFixed(0)}% of the record.`, priority: 'low', action: 'Learn more', onAction: () => setLearnTopic('trend') })
    }

    if (totalOutstanding > currentMonthRevenue * 0.3 && totalOutstanding > 500)
      list.push({ icon: '💸', title: 'Outstanding Revenue', msg: `${fmt$(totalOutstanding)} is waiting to be collected across ${d.unpaidCount} unpaid invoice${d.unpaidCount > 1 ? 's' : ''}. Follow up to improve cash flow.`, priority: 'medium', action: 'View invoices', onAction: () => router.push('/invoices') })

    if (profitMargin < 20 && income.length > 2)
      list.push({ icon: '📊', title: 'Low Profit Margin', msg: `Profit margin is ${profitMargin.toFixed(0)}%. Aim for 30%+ by reducing non-essential expenses or raising rates.`, priority: 'medium', action: 'View expenses', onAction: () => router.push('/expenses') })

    if (estimatedTax > 500)
      list.push({ icon: '🧮', title: 'Tax Reserve', msg: `Set aside ${fmt$(estimatedTax)} for estimated taxes (25% of profit). Don't wait until filing season.`, priority: 'low', action: 'Tax center', onAction: () => router.push('/tax') })

    return list.slice(0, 5)
  }, [d, income, router])

  /* ── Chart data ── */
  const chartData = useMemo(
    () => buildChartBuckets(income, expenses, invoices, activeTab, chartMetric),
    [income, expenses, invoices, activeTab, chartMetric]
  )

  /* ── Filtered income for search + showAll ── */
  const filteredIncome = useMemo(() => {
    let list = income
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(i => [i.client_name, i.category, i.notes, i.status, i.income_type].some(f => f?.toLowerCase().includes(q)))
    }
    return list
  }, [income, search])

  const recentIncome  = filteredIncome.slice(0, 8)
  const goalProgress  = useMemo(() => {
    const now = new Date()
    const dailyRate   = d.daysElapsed > 0 ? d.currentMonthRevenue / d.daysElapsed : 0
    const monthlyPct  = goals.monthly > 0 ? Math.min(100, (d.currentMonthRevenue / goals.monthly) * 100) : 0
    const qStart      = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const qRevenue    = income.filter(i => new Date(i.date) >= qStart).reduce((s, i) => s + Number(i.amount), 0)
    const quarterlyPct = goals.quarterly > 0 ? Math.min(100, (qRevenue / goals.quarterly) * 100) : 0
    const yearRevenue  = income.filter(i => new Date(i.date).getFullYear() === now.getFullYear()).reduce((s, i) => s + Number(i.amount), 0)
    const annualPct   = goals.annual > 0 ? Math.min(100, (yearRevenue / goals.annual) * 100) : 0
    return { monthlyPct, quarterlyPct, annualPct, monthlyRev: d.currentMonthRevenue, qRevenue, yearRevenue, projectedMonthly: dailyRate * d.daysInMonth }
  }, [d, goals, income])

  const lStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block' }
  const iStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 44, width: 260, marginBottom: 20 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
          {[...Array(5)].map((_, i) => <div key={i} style={{ height: 110 }} className="skeleton" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} style={{ height: 220, marginBottom: 20 }} className="skeleton" />)}
      </div>
    )
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  const metricColor = chartMetric === 'revenue' ? '#6366f1' : chartMetric === 'profit' ? '#10b981' : '#f59e0b'

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ══ HEADER ══ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Income</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Track your revenue, monitor growth, and stay on top of your business.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
              <input className="input" style={{ width: 200, height: 36, paddingLeft: 32, fontSize: 12 }}
                placeholder="Search income…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn-primary" style={{ minHeight: 44, padding: '0 18px' }} onClick={() => { setEditItem(null); setDrawerOpen(true) }}>+ Add Income</button>
            {/* Export */}
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" style={{ minHeight: 44 }} onClick={() => setExportOpen(s => !s)}>⬇ Export</button>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    style={{ position: 'absolute', top: '110%', right: 0, width: 210, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', zIndex: 40, padding: 8 }}>
                    {[
                      { label: 'Monthly Revenue (CSV)',   fn: exportMonth },
                      { label: 'Annual Report (CSV)',     fn: exportYear },
                      { label: 'All Income (CSV)',        fn: exportAll },
                      { label: 'Profit & Loss (CSV)',     fn: exportPnL },
                      { label: 'Tax Summary (CSV)',       fn: exportTax },
                      { label: 'PDF Report',              fn: () => { toast('PDF export coming soon 🚀'); setExportOpen(false) } },
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

        {/* ══ TAB CHIPS ══ */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {([
            { key: 'overview', label: 'Overview' },
            { key: '7d',       label: '7D' },
            { key: '30d',      label: '30D' },
            { key: '90d',      label: '90D' },
            { key: '1y',       label: '1Y' },
            { key: 'all',      label: 'All' },
          ] as { key: Tab; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: activeTab === t.key ? '#6366f1' : 'var(--bg3)',
                color: activeTab === t.key ? '#fff' : 'var(--mu)',
                transition: 'all 0.15s', minHeight: 36,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ EMPTY STATE ══ */}
        {income.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ width: 88, height: 88, borderRadius: 28, background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.18))', border: '1.5px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, margin: '0 auto 24px', animation: 'float 3s ease-in-out infinite' }}>
              💰
            </div>
            <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.035em', marginBottom: 10 }}>Ready to track your first sale?</h2>
            <p style={{ fontSize: 14, color: 'var(--mu)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 28px' }}>
              Record your first income transaction to unlock revenue forecasting, growth insights, and business health tracking.
            </p>
            <button className="btn-primary" style={{ padding: '13px 32px', fontSize: 14 }} onClick={() => setDrawerOpen(true)}>
              + Add Income
            </button>
          </motion.div>
        )}

        {income.length > 0 && (
          <>
            {/* ══ KPI CARDS (5) ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>

              {/* 1. Revenue */}
              <motion.div className="stat-card" style={{ position: 'relative', cursor: 'pointer' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>💰</span>
                  <InfoIcon topic="revenue" short={LEARN.revenue.short} onLearn={setLearnTopic} />
                </div>
                <div className="stat-label">Revenue <span style={{ color: 'var(--mu2)', textTransform: 'none', fontSize: 8 }}>({d.periodLabel})</span></div>
                <div className="stat-value" style={{ color: '#10b981', fontSize: 22 }}>
                  <CountUp end={d.periodRevenue} decimals={2} duration={1.2} separator="," prefix="$" />
                </div>
                {income.length > 1 && activeTab !== 'all' && (
                  <div className="stat-sub" style={{ color: d.growthPct >= 0 ? '#10b981' : '#ef4444', marginTop: 5, fontWeight: 700 }}>
                    {d.growthPct >= 0 ? '▲' : '▼'} {Math.abs(d.growthPct).toFixed(1)}% vs prev period
                  </div>
                )}
              </motion.div>

              {/* 2. Revenue Health */}
              <motion.div className="stat-card" style={{ cursor: 'pointer' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} onClick={() => setLearnTopic('health')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>❤️</span>
                  <InfoIcon topic="health" short={LEARN.health.short} onLearn={setLearnTopic} />
                </div>
                <div className="stat-label">Revenue Health</div>
                <div className="stat-value" style={{ color: d.healthColor, fontSize: 22 }}>
                  <CountUp end={d.healthScore} duration={1.3} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--mu)' }}>/100</span>
                </div>
                <div className="stat-sub" style={{ marginTop: 5 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 99, background: `${d.healthColor}18`, color: d.healthColor, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {d.healthLabel}
                  </span>
                </div>
              </motion.div>

              {/* 3. Outstanding */}
              <motion.div className="stat-card" style={{ cursor: 'pointer' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} onClick={() => router.push('/invoices')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>⏳</span>
                  <InfoIcon topic="outstanding" short={LEARN.outstanding.short} onLearn={setLearnTopic} />
                </div>
                <div className="stat-label">Outstanding Revenue</div>
                <div className="stat-value" style={{ color: d.totalOutstanding > 0 ? '#f59e0b' : '#10b981', fontSize: 22 }}>
                  <CountUp end={d.totalOutstanding} decimals={2} duration={1.2} separator="," prefix="$" />
                </div>
                <div className="stat-sub" style={{ marginTop: 5, color: d.overdueCount > 0 ? '#ef4444' : 'var(--mu)' }}>
                  {d.unpaidCount} unpaid{d.overdueCount > 0 ? ` · ${d.overdueCount} overdue` : ''}
                </div>
              </motion.div>

              {/* 4. Projected Month End */}
              <motion.div className="stat-card" style={{ cursor: 'pointer' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} onClick={() => setLearnTopic('projected')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>🔮</span>
                  <InfoIcon topic="projected" short={LEARN.projected.short} onLearn={setLearnTopic} />
                </div>
                <div className="stat-label">Projected Month End</div>
                <div className="stat-value" style={{ color: '#6366f1', fontSize: 22 }}>
                  <CountUp end={d.projectedMonthEnd} decimals={2} duration={1.2} separator="," prefix="$" />
                </div>
                <div className="stat-sub" style={{ marginTop: 5 }}>
                  Day {d.daysElapsed} of {d.daysInMonth}
                </div>
              </motion.div>

              {/* 5. Revenue Goal */}
              <motion.div className="stat-card" style={{ cursor: 'pointer' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }}
                onClick={() => { setGoalDraft({ ...goals }); setEditGoals(true) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>🎯</span>
                  <InfoIcon topic="goal" short={LEARN.goal.short} onLearn={setLearnTopic} />
                </div>
                <div className="stat-label">Revenue Goal</div>
                {goals.monthly > 0 ? (
                  <>
                    <div className="stat-value" style={{ color: goalProgress.monthlyPct >= 100 ? '#10b981' : '#6366f1', fontSize: 22 }}>
                      {goalProgress.monthlyPct.toFixed(0)}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--mu)' }}>%</span>
                    </div>
                    <div className="progress-track" style={{ marginTop: 8 }}>
                      <motion.div className="progress-fill" initial={{ width: 0 }}
                        animate={{ width: `${goalProgress.monthlyPct}%` }} transition={{ duration: 0.9 }}
                        style={{ background: goalProgress.monthlyPct >= 100 ? '#10b981' : '#6366f1' }} />
                    </div>
                    <div className="stat-sub" style={{ marginTop: 5 }}>{fmt$(goalProgress.monthlyRev, 0)} / {fmt$(goals.monthly, 0)}</div>
                  </>
                ) : (
                  <>
                    <div className="stat-value" style={{ color: 'var(--mu)', fontSize: 16, fontWeight: 700, marginTop: 4 }}>No goal set</div>
                    <div className="stat-sub" style={{ marginTop: 5, color: '#6366f1', fontWeight: 700 }}>Tap to set a goal →</div>
                  </>
                )}
              </motion.div>
            </div>

            {/* ══ REVENUE TREND CHART ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Revenue Trend</h2>
                  <InfoIcon topic="trend" short={LEARN.trend.short} onLearn={setLearnTopic} />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['revenue','profit','outstanding'] as Metric[]).map(m => (
                    <button key={m} onClick={() => setChartMetric(m)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s', background: chartMetric === m ? metricColor : 'var(--bg3)', color: chartMetric === m ? '#fff' : 'var(--mu)' }}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {chartData.every(b => b.value === 0) ? (
                <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--mu)' }}>
                  <span style={{ fontSize: 32, marginBottom: 10 }}>📈</span>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>No data for this period</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gMain" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={metricColor} stopOpacity={0.22} />
                        <stop offset="95%" stopColor={metricColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="value" name={chartMetric} stroke={metricColor} strokeWidth={2.5} fill="url(#gMain)" dot={false} activeDot={{ r: 5, fill: metricColor }} animationDuration={700} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* ══ INSIGHTS + TOP CLIENTS ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Revenue Insights */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Revenue Insights</h2>
                    <InfoIcon topic="insights" short={LEARN.insights.short} onLearn={setLearnTopic} />
                  </div>
                  <div className="live-dot" />
                </div>
                {insights.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>💡</span>
                    <p style={{ fontSize: 12 }}>No insights yet — add more income data to unlock analysis.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {insights.map((ins, i) => (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg3)', borderLeft: `3px solid ${ins.priority === 'high' ? '#ef4444' : ins.priority === 'medium' ? '#f59e0b' : '#10b981'}` }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{ins.icon}</span>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{ins.title}</p>
                            <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.55 }}>{ins.msg}</p>
                          </div>
                        </div>
                        {ins.action && ins.onAction && (
                          <button onClick={ins.onAction} style={{ fontSize: 10, fontWeight: 800, color: ins.priority === 'high' ? '#ef4444' : ins.priority === 'medium' ? '#f59e0b' : '#10b981', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            {ins.action} →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Top Clients */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 260px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Top Clients</h2>
                  <InfoIcon topic="clients" short={LEARN.clients.short} onLearn={setLearnTopic} />
                </div>
                {d.topClients.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>👥</span>
                    <p style={{ fontSize: 12 }}>Add income with client names to see rankings.</p>
                    <button className="btn-ghost" style={{ marginTop: 12, fontSize: 11 }} onClick={() => setDrawerOpen(true)}>Add Income →</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {d.topClients.map((c, i) => {
                      const clientObj = clients.find(x => x.name.toLowerCase() === c.name.toLowerCase())
                      return (
                        <button key={c.name}
                          onClick={() => clientObj ? router.push(`/clients/${clientObj.id}`) : undefined}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: clientObj ? 'pointer' : 'default', textAlign: 'left', padding: '4px 0', width: '100%' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: CAT_COLORS[i % CAT_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                              <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", fontWeight: 700, color: '#10b981', flexShrink: 0, marginLeft: 8 }}>{fmt$(c.rev)}</span>
                            </div>
                            <div className="progress-track" style={{ height: 4 }}>
                              <div className="progress-fill" style={{ width: `${c.pct}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                            </div>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--mu)', flexShrink: 0, minWidth: 28, textAlign: 'right' }}>{c.pct.toFixed(0)}%</span>
                        </button>
                      )
                    })}
                    {d.topConcentration > 50 && (
                      <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                        ⚠️ Top client = {d.topConcentration.toFixed(0)}% of revenue. Concentration risk.
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ══ CATEGORY CHART + RECENT INCOME ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Income by Category (donut) */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 260px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Income by Category</h2>
                  <InfoIcon topic="categories" short={LEARN.categories.short} onLearn={setLearnTopic} />
                </div>
                {d.topCategories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📊</span>
                    <p style={{ fontSize: 12 }}>No category data for this period.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flexShrink: 0 }}>
                      <PieChart width={140} height={140}>
                        <Pie data={d.topCategories.map(c => ({ name: c.cat, value: c.amt }))} cx={65} cy={65} innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={2} animationBegin={0} animationDuration={700}>
                          {d.topCategories.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [fmt$(Number(v)), '']} />
                      </PieChart>
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      {d.topCategories.slice(0, 6).map((c, i) => (
                        <div key={c.cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'var(--mu)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cat}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>{c.pct.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Recent Income */}
              <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden', flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Recent Income</h2>
                  <button onClick={() => setShowAll(s => !s)} style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {showAll ? 'Show less' : `View all ${filteredIncome.length}`}
                  </button>
                </div>
                {recentIncome.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--mu)' }}>
                    <p style={{ fontSize: 28, marginBottom: 8 }}>💰</p>
                    <p style={{ fontSize: 12 }}>{search ? 'No results for your search.' : 'No income recorded yet.'}</p>
                  </div>
                ) : (
                  <div>
                    {(showAll ? filteredIncome : recentIncome).map((item, idx) => (
                      <div key={item.id} style={{ padding: '12px 20px', borderBottom: idx < (showAll ? filteredIncome : recentIncome).length - 1 ? '1px solid var(--bd)' : 'none', display: 'flex', alignItems: 'center', gap: 12, transition: 'background 0.12s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                          {item.is_recurring ? '🔄' : '💰'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.client_name || item.category || '—'}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                            <span className={`status-pill status-${item.status}`}>{item.status}</span>
                            <span style={{ fontSize: 10, color: 'var(--mu)' }}>{item.category}</span>
                            {item.invoice_ref && <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 700 }}>#{item.invoice_ref}</span>}
                            <span style={{ fontSize: 10, color: 'var(--mu)' }}>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, fontSize: 13, color: '#10b981' }}>+{fmt$(Number(item.amount))}</p>
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
                            <button onClick={() => { setEditItem(item); setDrawerOpen(true) }}
                              style={{ fontSize: 10, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 5, fontWeight: 700 }}>
                              Edit
                            </button>
                            <button onClick={() => remove(item.id)}
                              style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 5, fontWeight: 700 }}>
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ══ REVENUE GOALS ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: goals.monthly > 0 ? 20 : 0, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Revenue Goals</h2>
                  <InfoIcon topic="goal" short={LEARN.goal.short} onLearn={setLearnTopic} />
                </div>
                <button className="btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => { setGoalDraft({ ...goals }); setEditGoals(s => !s) }}>
                  {editGoals ? 'Cancel' : goals.monthly > 0 ? '✏️ Edit Goals' : '+ Set Goals'}
                </button>
              </div>

              <AnimatePresence>
                {editGoals && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, paddingBottom: 16 }}>
                      {(['monthly','quarterly','annual'] as const).map(k => (
                        <div key={k}>
                          <label style={lStyle}>{k.charAt(0).toUpperCase() + k.slice(1)} Goal</label>
                          <div style={{ position: 'relative', marginTop: 6 }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 13 }}>$</span>
                            <input type="number" min="0" step="100" style={{ ...iStyle, marginTop: 0, paddingLeft: 26 }}
                              value={goalDraft[k] || ''}
                              onChange={e => setGoalDraft(g => ({ ...g, [k]: parseFloat(e.target.value) || 0 }))}
                              placeholder="0" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="btn-primary" onClick={saveGoals} style={{ padding: '9px 20px' }}>Save Goals</button>
                  </motion.div>
                )}
              </AnimatePresence>

              {goals.monthly > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                  {[
                    { k: 'monthly' as const,   label: 'Monthly',   pct: goalProgress.monthlyPct,   current: goalProgress.monthlyRev,   proj: goalProgress.projectedMonthly, color: '#6366f1' },
                    { k: 'quarterly' as const,  label: 'Quarterly', pct: goalProgress.quarterlyPct,  current: goalProgress.qRevenue,     proj: 0, color: '#10b981' },
                    { k: 'annual' as const,     label: 'Annual',    pct: goalProgress.annualPct,     current: goalProgress.yearRevenue,  proj: 0, color: '#f59e0b' },
                  ].filter(g => goals[g.k] > 0).map(g => (
                    <div key={g.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{g.label}</span>
                        <span style={{ fontFamily: "DM Mono, monospace", fontWeight: 800, color: g.color }}>{fmt$(g.current, 0)} / {fmt$(goals[g.k], 0)}</span>
                      </div>
                      <div className="progress-track" style={{ marginBottom: 5 }}>
                        <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${g.pct}%` }} transition={{ duration: 0.9 }} style={{ background: g.color }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--mu)' }}>
                        <span>{g.pct.toFixed(0)}% complete</span>
                        {g.current < goals[g.k] && <span>{fmt$(goals[g.k] - g.current, 0)} to go</span>}
                        {g.k === 'monthly' && g.proj > 0 && (
                          <span style={{ color: g.proj >= goals[g.k] ? '#10b981' : '#f59e0b' }}>proj. {fmt$(g.proj, 0)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !editGoals ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--mu)' }}>
                  <p style={{ fontSize: 13 }}>Set monthly, quarterly, and annual revenue targets to track your progress.</p>
                </div>
              ) : null}
            </motion.div>

            {/* ══ REVENUE OPPORTUNITIES ══ */}
            {(d.missingThisMonth.length > 0 || d.recurringMissing.length > 0 || d.totalOutstanding > 0) && (
              <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Revenue Opportunities</h2>
                  <InfoIcon topic="opportunities" short={LEARN.opportunities.short} onLearn={setLearnTopic} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Clients who paid last month but not this month */}
                  {d.missingThisMonth.slice(0, 3).map(clientName => (
                    <div key={clientName} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--bd)', flexWrap: 'wrap' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>💼</div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{clientName}</p>
                        <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Generated {fmt$(d.missingAmounts[clientName] ?? 0)} last month — no income recorded this month.</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 12px' }}
                          onClick={() => { setEditItem(null); setDrawerOpen(true) }}>
                          Add Income
                        </button>
                        <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 12px' }} onClick={() => router.push('/invoices')}>Create Invoice</button>
                      </div>
                    </div>
                  ))}

                  {/* Recurring income missing */}
                  {d.recurringMissing.slice(0, 2).map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid rgba(99,102,241,0.2)', flexWrap: 'wrap' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🔄</div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.client_name || item.category}</p>
                        <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Expected monthly recurring income of {fmt$(Number(item.amount))} not recorded yet this month.</p>
                      </div>
                      <button className="btn-primary" style={{ fontSize: 11, padding: '6px 14px', flexShrink: 0 }}
                        onClick={() => { setEditItem(null); setDrawerOpen(true) }}>
                        Record Now
                      </button>
                    </div>
                  ))}

                  {/* Outstanding invoices */}
                  {d.totalOutstanding > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid rgba(245,158,11,0.2)', flexWrap: 'wrap' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📤</div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Outstanding Invoices</p>
                        <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{fmt$(d.totalOutstanding)} across {d.unpaidCount} unpaid invoice{d.unpaidCount > 1 ? 's' : ''} ready to collect.</p>
                      </div>
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 12px', flexShrink: 0 }} onClick={() => router.push('/invoices')}>
                        Follow Up →
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ══ MOBILE: All transactions (desktop shows in Recent Income via showAll) ══ */}
            <div className="mobile-cards">
              {filteredIncome.slice(0, showAll ? undefined : 8).map(item => (
                <div key={item.id} className="mobile-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.client_name || '—'}</p>
                      <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>{item.category}{item.is_recurring ? ' · 🔄' : ''}</p>
                    </div>
                    <p style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, color: '#10b981', fontSize: 15, flexShrink: 0 }}>+{fmt$(Number(item.amount))}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className={`status-pill status-${item.status}`}>{item.status}</span>
                      <span style={{ fontSize: 11, color: 'var(--mu)' }}>{new Date(item.date).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditItem(item); setDrawerOpen(true) }} style={{ fontSize: 12, color: '#6366f1', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>Edit</button>
                      <button onClick={() => remove(item.id)} style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredIncome.length > 8 && (
                <button onClick={() => setShowAll(s => !s)} className="btn-ghost" style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
                  {showAll ? 'Show less' : `View all ${filteredIncome.length} transactions`}
                </button>
              )}
            </div>
          </>
        )}

        {/* Mobile FAB */}
        <style>{`
          .income-fab { display: none; }
          @media (max-width: 767px) {
            .income-fab { display: flex; position: fixed; bottom: 80px; right: 20px; z-index: 50; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#8b5cf6); border: none; cursor: pointer; align-items: center; justify-content: center; font-size: 24px; color: #fff; box-shadow: 0 8px 24px rgba(99,102,241,0.4); }
          }
          .mobile-cards { display: none; }
          @media (max-width: 767px) { .mobile-cards { display: block; padding: 8px 0; } }
        `}</style>
        <button className="income-fab" aria-label="Add income" onClick={() => { setEditItem(null); setDrawerOpen(true) }}>+</button>

      </motion.div>

      {/* ══ INCOME DRAWER ══ */}
      <IncomeDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditItem(null) }}
        onSaved={item => { setIncome(prev => [item, ...prev]); setDrawerOpen(false) }}
        onUpdated={item => { setIncome(prev => prev.map(i => i.id === item.id ? item : i)); setDrawerOpen(false); setEditItem(null) }}
        editItem={editItem}
        invoiceList={invoices}
        userId={userId}
      />

      {/* ══ LEARN PANEL ══ */}
      <LearnPanel topic={learnTopic} onClose={() => setLearnTopic(null)} />
    </div>
  )
}
