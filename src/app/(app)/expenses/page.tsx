'use client'
/*
 * PROFIT PROTECTION CENTER — Expense Command Center
 * Migrations: expense_analytics.sql + expense_command_center.sql
 * All analytics from real Supabase data. No mock data.
 * Font names with spaces: template literals or double-quoted strings — never single-quoted.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import CountUp from 'react-countup'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Expense = {
  id: string; date: string; amount: number; vendor: string; category: string
  payment_method?: string; is_deductible: boolean; status: string
  notes?: string; is_subscription?: boolean; subscription_period?: string
  receipt_ref?: string; receipt_url?: string; business_purpose?: string
  source_system?: string; account_last4?: string; sync_status?: string
  linked_client?: string; user_id?: string
}
type IncomeRow  = { amount: number; date: string }
type ClientRow  = { id: string; name: string }

/* ─── Constants ──────────────────────────────────────────────────────────── */
const CATEGORIES  = ['Operations','Software','Marketing','Payroll','Office','Travel','Meals','Equipment','Professional Services','Insurance','Rent','Utilities','Other']
const METHODS     = ['Bank Transfer','Credit Card','PayPal','Check','Cash','Other']
const RECURRENCE  = ['monthly','quarterly','annual']
const CAT_COLORS  = ['#6366f1','#ff7043','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#10b981','#14b8a6','#64748b','#f97316','#84cc16','#a78bfa']

const CAT_TIPS: Record<string, string> = {
  Software:               'Subscriptions, SaaS tools, apps, hosting. Typically 100% deductible.',
  Marketing:              'Ads, content, SEO, social media. 100% deductible as ordinary business expense.',
  'Professional Services':'Accounting, legal, consulting fees. 100% deductible.',
  Office:                 'Supplies, furniture, equipment. Deductible; equipment may need depreciation.',
  Travel:                 'Business flights, hotels, transportation. 100% deductible with documented purpose.',
  Meals:                  'Business meals are 50% deductible. Keep notes on who attended and the purpose.',
  Equipment:              'Computers, tools, machines. Deductible; may qualify for Section 179 expensing.',
  Insurance:              'Business insurance premiums. 100% deductible.',
  Rent:                   'Office, coworking, storage rent. 100% deductible.',
  Utilities:              'Internet, phone, electricity for business. Prorated if home-based.',
  Payroll:                'Employee wages and benefits. 100% deductible.',
  Operations:             'Miscellaneous business operations. Usually deductible with documentation.',
  Other:                  'Classify properly to maximise deductions.',
}

const DEFAULT_FORM = {
  date: new Date().toISOString().split('T')[0],
  amount: '', vendor: '', category: 'Operations', payment_method: 'Bank Transfer',
  is_deductible: true, status: 'paid', notes: '',
  is_subscription: false, subscription_period: 'monthly',
  receipt_ref: '', receipt_url: '', business_purpose: '', linked_client: '',
}

/* ─── Utilities ──────────────────────────────────────────────────────────── */
function fmt$(n: number, dec = 2) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}

function buildMonthly(expenses: Expense[], income: IncomeRow[], count: number) {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const exp = expenses.filter(x => { const xd = new Date(x.date); return xd >= d && xd <= end }).reduce((s, x) => s + Number(x.amount), 0)
    const inc = income.filter(x => { const xd = new Date(x.date); return xd >= d && xd <= end }).reduce((s, x) => s + Number(x.amount), 0)
    return { label: d.toLocaleString('default', { month: 'short', year: '2-digit' }), expenses: exp, income: inc, net: inc - exp }
  })
}

/* ─── Chart tooltip ──────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 11 }}>
      <p style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 5 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>{p.name}: <strong>{fmt$(p.value)}</strong></p>)}
    </div>
  )
}

/* ─── InfoIcon ───────────────────────────────────────────────────────────── */
function InfoIcon({ tip, onLearn }: { tip: string; onLearn?: () => void }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
      <button type="button"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)}
        onClick={e => { e.stopPropagation(); onLearn?.() }}
        style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--bd2)', color: 'var(--mu)', fontSize: 9, cursor: onLearn ? 'pointer' : 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>
        i
      </button>
      {show && (
        <span role="tooltip" style={{ position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: 'var(--ink)', lineHeight: 1.6, width: 200, zIndex: 99, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', pointerEvents: 'none', whiteSpace: 'normal', fontWeight: 400 }}>
          {tip}
          {onLearn && <span style={{ display: 'block', marginTop: 3, color: '#ff7043', fontWeight: 700, fontSize: 10 }}>Click to learn more →</span>}
        </span>
      )}
    </span>
  )
}

/* ─── Expense Drawer (Add / Edit / Duplicate) ────────────────────────────── */
function ExpenseDrawer({
  open, onClose, onSaved, onUpdated, editItem, prefillItem,
  userId, currentMonthRevenue, currentMonthExpenses, avgMonthlyExpenses, clients,
}: {
  open: boolean; onClose: () => void
  onSaved: (item: Expense) => void; onUpdated: (item: Expense) => void
  editItem: Expense | null; prefillItem: Expense | null
  userId: string; currentMonthRevenue: number
  currentMonthExpenses: number; avgMonthlyExpenses: number
  clients: ClientRow[]
}) {
  const isEdit = !!editItem
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const src = editItem ?? prefillItem
    setForm(src ? {
      date: src.date, amount: String(src.amount), vendor: src.vendor,
      category: src.category, payment_method: src.payment_method ?? 'Bank Transfer',
      is_deductible: src.is_deductible, status: src.status,
      notes: src.notes ?? '', is_subscription: src.is_subscription ?? false,
      subscription_period: src.subscription_period ?? 'monthly',
      receipt_ref: src.receipt_ref ?? '', receipt_url: src.receipt_url ?? '',
      business_purpose: src.business_purpose ?? '', linked_client: src.linked_client ?? '',
    } : { ...DEFAULT_FORM })
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, editItem, prefillItem, onClose])

  /* Profit impact preview */
  const impact = useMemo(() => {
    const amt = parseFloat(form.amount) || 0
    if (amt <= 0) return null
    const profitBefore    = currentMonthRevenue - currentMonthExpenses
    const profitAfter     = profitBefore - amt
    const marginBefore    = currentMonthRevenue > 0 ? (profitBefore / currentMonthRevenue) * 100 : 0
    const marginAfter     = currentMonthRevenue > 0 ? (profitAfter / currentMonthRevenue) * 100 : 0
    const taxSavings      = form.is_deductible ? amt * 0.25 : 0
    const avgDaily        = avgMonthlyExpenses > 0 ? avgMonthlyExpenses / 30 : 1
    const runwayImpactDays = Math.round(amt / avgDaily)
    return { profitBefore, profitAfter, marginBefore, marginAfter, taxSavings, runwayImpactDays }
  }, [form.amount, form.is_deductible, currentMonthRevenue, currentMonthExpenses, avgMonthlyExpenses])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.vendor.trim()) { toast.error('Enter a vendor name'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      ...form, amount: parseFloat(form.amount),
      is_subscription: form.is_subscription,
      subscription_period: form.is_subscription ? form.subscription_period : null,
      notes: form.notes || null, receipt_ref: form.receipt_ref || null,
      receipt_url: form.receipt_url || null, business_purpose: form.business_purpose || null,
      linked_client: form.linked_client || null,
      source_system: isEdit ? (editItem?.source_system ?? 'manual') : 'manual',
    }
    if (isEdit && editItem) {
      const { data, error } = await sb.from('expenses').update(payload).eq('id', editItem.id).select().single()
      setSaving(false)
      if (error) { toast.error('Failed to save'); return }
      toast.success('Expense updated ✓'); onUpdated(data as Expense); onClose()
    } else {
      const { data, error } = await sb.from('expenses').insert({ user_id: userId, ...payload }).select().single()
      setSaving(false)
      if (error) { toast.error('Failed to add expense'); return }
      toast.success('Expense added ✓'); onSaved(data as Expense); onClose()
    }
  }

  const iStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }
  const lStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block' }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 799 }} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="side-drawer-panel"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 500, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
              <div>
                <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                  {isEdit ? 'Edit Expense' : prefillItem ? 'Duplicate Expense' : 'Add Expense'}
                </h3>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>All fields marked * are required.</p>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={submit} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                {/* Core fields */}
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Vendor *</label>
                  <input style={iStyle} required placeholder="Adobe, AWS, Office Depot…" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
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
                  <label style={lStyle}>Payment Method</label>
                  <select style={iStyle} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                    {METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>

                {/* Business context */}
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Business Purpose (optional)</label>
                  <input style={iStyle} placeholder="e.g. Client project tools, team communication, ad spend" value={form.business_purpose} onChange={e => setForm(f => ({ ...f, business_purpose: e.target.value }))} />
                </div>
                {clients.length > 0 && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lStyle}>Linked Client (optional)</label>
                    <select style={iStyle} value={form.linked_client} onChange={e => setForm(f => ({ ...f, linked_client: e.target.value }))}>
                      <option value="">No client linked</option>
                      {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Toggles */}
                <div style={{ gridColumn: '1/-1', display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)', minHeight: 44 }}>
                    <input type="checkbox" checked={form.is_deductible} onChange={e => setForm(f => ({ ...f, is_deductible: e.target.checked }))} />
                    Tax deductible
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)', minHeight: 44 }}>
                    <input type="checkbox" checked={form.is_subscription} onChange={e => setForm(f => ({ ...f, is_subscription: e.target.checked }))} />
                    Subscription / recurring
                  </label>
                  {form.is_subscription && (
                    <select style={{ ...iStyle, marginTop: 0, width: 'auto' }} value={form.subscription_period} onChange={e => setForm(f => ({ ...f, subscription_period: e.target.value }))}>
                      {RECURRENCE.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  )}
                </div>

                {/* Receipt */}
                <div>
                  <label style={lStyle}>Receipt Reference</label>
                  <input style={iStyle} placeholder="REC-001, filename…" value={form.receipt_ref} onChange={e => setForm(f => ({ ...f, receipt_ref: e.target.value }))} />
                </div>
                <div>
                  <label style={lStyle}>Receipt URL</label>
                  <input style={iStyle} placeholder="https://…" value={form.receipt_url} onChange={e => setForm(f => ({ ...f, receipt_url: e.target.value }))} />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Notes</label>
                  <textarea style={{ ...iStyle, height: 68, resize: 'none', lineHeight: 1.6 }} placeholder="Additional notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                {/* Source info */}
                <div style={{ gridColumn: '1/-1', padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--bd)' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', marginBottom: 3 }}>Source: Manual Entry</p>
                  <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>
                    Bank, card, and POS import coming soon — Plaid, Stripe, Square, Shopify, and more.
                  </p>
                </div>
              </div>

              {/* Profit Impact Preview */}
              {impact && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: 16, padding: '14px 16px', borderRadius: 14, background: 'var(--bg3)', border: '1px solid var(--bd)' }}>
                  <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)', marginBottom: 10 }}>Expense Impact Preview</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Monthly Profit', before: impact.profitBefore, after: impact.profitAfter, fmt: (v: number) => fmt$(v), color: impact.profitAfter >= 0 ? '#10b981' : '#ef4444' },
                      { label: 'Profit Margin', before: impact.marginBefore, after: impact.marginAfter, fmt: (v: number) => `${v.toFixed(1)}%`, color: impact.marginAfter >= 20 ? '#10b981' : '#f59e0b' },
                    ].map(r => (
                      <div key={r.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg2)' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mu2)', marginBottom: 4 }}>{r.label}</p>
                        <p style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--mu)', fontFamily: "DM Mono, monospace" }}>{r.fmt(r.before)}</span>
                          <span style={{ color: 'var(--mu)', margin: '0 5px' }}>→</span>
                          <span style={{ fontWeight: 700, color: r.color, fontFamily: "DM Mono, monospace" }}>{r.fmt(r.after)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    {impact.taxSavings > 0 && (
                      <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 2 }}>Est. Tax Savings</p>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#10b981', fontFamily: "DM Mono, monospace" }}>+{fmt$(impact.taxSavings)}</p>
                      </div>
                    )}
                    {avgMonthlyExpenses > 0 && (
                      <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 2 }}>Runway Impact</p>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', fontFamily: "DM Mono, monospace" }}>-{impact.runwayImpactDays}d</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </form>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 10 }}>
              <button onClick={submit as unknown as React.MouseEventHandler} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '13px 20px', fontSize: 14 }}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Expense'}
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
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function ExpensesPage() {
  const router = useRouter()

  /* ── Data ── */
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [income, setIncome]     = useState<IncomeRow[]>([])
  const [clients, setClients]   = useState<ClientRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState('')

  /* ── UI ── */
  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [editItem, setEditItem]         = useState<Expense | null>(null)
  const [prefillItem, setPrefillItem]   = useState<Expense | null>(null)
  const [exportOpen, setExportOpen]     = useState(false)
  const [showAll, setShowAll]           = useState(false)
  const [search, setSearch]             = useState('')
  const [learnCat, setLearnCat]         = useState<string | null>(null)
  const [trendRange, setTrendRange]     = useState<'3m' | '6m' | '12m'>('6m')

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [expRes, incRes, cliRes] = await Promise.all([
      sb.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      sb.from('income').select('amount,date').eq('user_id', user.id),
      sb.from('clients').select('id,name').eq('user_id', user.id).is('archived_at', null),
    ])
    setExpenses(expRes.data ?? [])
    setIncome(incRes.data ?? [])
    setClients(cliRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ════════════════════════════════════════════════════════════════════
     CENTRALISED COMPUTED DATA
  ════════════════════════════════════════════════════════════════════ */
  const d = useMemo(() => {
    const now            = new Date()
    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevStart      = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevEnd        = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

    /* ── Expense aggregates ── */
    const totalExpenses        = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const currentMonthExpenses = expenses.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + Number(e.amount), 0)
    const prevMonthExpenses    = expenses.filter(e => { const d = new Date(e.date); return d >= prevStart && d <= prevEnd }).reduce((s, e) => s + Number(e.amount), 0)
    const expGrowthPct         = prevMonthExpenses > 0 ? ((currentMonthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100 : currentMonthExpenses > 0 ? 100 : 0
    const recentThree          = expenses.filter(e => new Date(e.date) >= threeMonthsAgo).reduce((s, e) => s + Number(e.amount), 0)
    const avgMonthlyExpenses   = recentThree > 0 ? recentThree / 3 : totalExpenses > 0 ? totalExpenses / 6 : 0
    const annualForecast       = avgMonthlyExpenses * 12
    const yearStart            = new Date(now.getFullYear(), 0, 1)
    const yearExpenses         = expenses.filter(e => new Date(e.date) >= yearStart).reduce((s, e) => s + Number(e.amount), 0)

    /* ── Deductible ── */
    const deductibleTotal    = expenses.filter(e => e.is_deductible).reduce((s, e) => s + Number(e.amount), 0)
    const deductibleRatio    = totalExpenses > 0 ? deductibleTotal / totalExpenses : 0
    const estimatedTaxSavings = deductibleTotal * 0.25

    /* ── Income (for burn rate) ── */
    const currentMonthRevenue = income.filter(i => new Date(i.date) >= monthStart).reduce((s, i) => s + Number(i.amount), 0)
    const totalIncome         = income.reduce((s, i) => s + Number(i.amount), 0)
    const burnRate            = currentMonthRevenue > 0 ? (currentMonthExpenses / currentMonthRevenue) * 100 : expenses.length > 0 ? 60 : 0
    const profitMargin        = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0
    const netCash             = totalIncome - totalExpenses

    /* ── Revenue growth (for comparison) ── */
    const prevRevenue  = income.filter(i => { const d = new Date(i.date); return d >= prevStart && d <= prevEnd }).reduce((s, i) => s + Number(i.amount), 0)
    const revGrowthPct = prevRevenue > 0 ? ((currentMonthRevenue - prevRevenue) / prevRevenue) * 100 : 0

    /* ── Category breakdown ── */
    const catExp: Record<string, number> = {}
    expenses.forEach(e => { catExp[e.category] = (catExp[e.category] ?? 0) + Number(e.amount) })
    const topCategories = Object.entries(catExp).sort((a, b) => b[1] - a[1])
      .map(([cat, amt], idx) => ({ cat, amt, pct: totalExpenses > 0 ? amt / totalExpenses * 100 : 0, color: CAT_COLORS[idx % CAT_COLORS.length] }))
    const largestCat   = topCategories[0]

    /* ── Category MoM change ── */
    const prevCatExp: Record<string, number> = {}
    expenses.filter(e => { const d = new Date(e.date); return d >= prevStart && d <= prevEnd }).forEach(e => { prevCatExp[e.category] = (prevCatExp[e.category] ?? 0) + Number(e.amount) })
    const currCatExp: Record<string, number> = {}
    expenses.filter(e => new Date(e.date) >= monthStart).forEach(e => { currCatExp[e.category] = (currCatExp[e.category] ?? 0) + Number(e.amount) })
    const growingCats = Object.entries(currCatExp)
      .map(([cat, curr]) => ({ cat, curr, prev: prevCatExp[cat] ?? 0, growth: prevCatExp[cat] ? ((curr - prevCatExp[cat]) / prevCatExp[cat]) * 100 : curr > 0 ? 100 : 0 }))
      .filter(c => c.growth > 20).sort((a, b) => b.growth - a.growth)

    /* ── Vendor breakdown ── */
    const vendorExp: Record<string, { amt: number; txns: number; category: string }> = {}
    expenses.forEach(e => {
      if (!vendorExp[e.vendor]) vendorExp[e.vendor] = { amt: 0, txns: 0, category: e.category }
      vendorExp[e.vendor].amt += Number(e.amount); vendorExp[e.vendor].txns++
      vendorExp[e.vendor].category = e.category
    })
    const topVendors = Object.entries(vendorExp).sort((a, b) => b[1].amt - a[1].amt).slice(0, 6)
      .map(([vendor, v], idx) => ({ vendor, ...v, pct: totalExpenses > 0 ? v.amt / totalExpenses * 100 : 0, color: CAT_COLORS[idx % CAT_COLORS.length] }))
    const topVendorPct = topVendors[0]?.pct ?? 0

    /* ── Subscription detection ── */
    const vendorMonths: Record<string, { months: Set<string>; amounts: number[]; category: string; isMarked: boolean }> = {}
    expenses.forEach(e => {
      const key = e.vendor.toLowerCase().trim()
      if (!vendorMonths[key]) vendorMonths[key] = { months: new Set(), amounts: [], category: e.category, isMarked: false }
      vendorMonths[key].months.add(e.date.substring(0, 7))
      vendorMonths[key].amounts.push(Number(e.amount))
      if (e.is_subscription) vendorMonths[key].isMarked = true
      vendorMonths[key].category = e.category
    })
    const detectedSubs = Object.entries(vendorMonths)
      .filter(([_, v]) => v.months.size >= 2 || v.isMarked)
      .map(([vendor, v]) => {
        const avg = v.amounts.reduce((s, a) => s + a, 0) / v.amounts.length
        const cv  = avg > 0 ? Math.sqrt(v.amounts.map(a => (a - avg) ** 2).reduce((s, x) => s + x, 0) / v.amounts.length) / avg : 1
        return { vendor, monthlyAvg: avg, months: v.months.size, category: v.category, consistency: cv, isMarked: v.isMarked }
      })
      .filter(s => s.consistency < 0.25 || s.isMarked)
      .sort((a, b) => b.monthlyAvg - a.monthlyAvg).slice(0, 10)
    const subMonthlyTotal = detectedSubs.reduce((s, x) => s + x.monthlyAvg, 0)
    const subAnnualTotal  = subMonthlyTotal * 12

    /* ── Duplicate detection ── */
    const byVendorLower: Record<string, Expense[]> = {}
    expenses.forEach(e => {
      const key = e.vendor.toLowerCase().trim()
      if (!byVendorLower[key]) byVendorLower[key] = []
      byVendorLower[key].push(e)
    })
    const potentialDuplicates: { e1: Expense; e2: Expense; daysDiff: number }[] = []
    Object.values(byVendorLower).forEach(vendorExps => {
      if (vendorExps.length < 2) return
      const sorted = [...vendorExps].sort((a, b) => a.date.localeCompare(b.date))
      for (let i = 0; i < sorted.length - 1; i++) {
        const days = Math.abs(new Date(sorted[i].date).getTime() - new Date(sorted[i+1].date).getTime()) / 86400000
        if (days > 7) continue
        const a1 = Number(sorted[i].amount), a2 = Number(sorted[i+1].amount)
        if (a1 > 0 && Math.abs(a1 - a2) / Math.max(a1, a2) <= 0.05)
          potentialDuplicates.push({ e1: sorted[i], e2: sorted[i+1], daysDiff: Math.round(days) })
      }
    })

    /* ── Receipt stats ── */
    const withReceipt    = expenses.filter(e => e.receipt_ref || e.receipt_url).length
    const missingReceipt = expenses.length - withReceipt
    const dedMissingReceipt = expenses.filter(e => e.is_deductible && !e.receipt_ref && !e.receipt_url).length

    /* ── Expense Health Score ── */
    let healthScore = 65
    if (burnRate > 90)       healthScore -= 25; else if (burnRate > 70) healthScore -= 15; else if (burnRate > 50) healthScore -= 8; else if (burnRate < 30 && expenses.length > 0) healthScore += 10
    if (expGrowthPct > 30)   healthScore -= 15; else if (expGrowthPct > 15) healthScore -= 8; else if (expGrowthPct < 0) healthScore += 8
    if (topVendorPct > 60)   healthScore -= 12; else if (topVendorPct > 40) healthScore -= 6
    if (deductibleRatio < 0.3 && expenses.length > 3) healthScore -= 10; else if (deductibleRatio > 0.7) healthScore += 5
    healthScore -= Math.min(15, potentialDuplicates.length * 5)
    if (subMonthlyTotal / Math.max(1, avgMonthlyExpenses) > 0.4) healthScore -= 8
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))
    const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Healthy' : healthScore >= 40 ? 'Watch Closely' : 'Spending Risk'
    const healthColor = healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#0ea5e9' : healthScore >= 40 ? '#f59e0b' : '#ef4444'

    const healthFactors = [
      { label: 'Burn Rate',            val: expenses.length > 0 ? `${burnRate.toFixed(0)}%` : '—', color: burnRate < 40 ? '#10b981' : burnRate < 70 ? '#f59e0b' : '#ef4444' },
      { label: 'MoM Change',           val: `${expGrowthPct >= 0 ? '+' : ''}${expGrowthPct.toFixed(0)}%`,           color: expGrowthPct <= 5 ? '#10b981' : expGrowthPct <= 20 ? '#f59e0b' : '#ef4444' },
      { label: 'Deductible Ratio',     val: `${(deductibleRatio * 100).toFixed(0)}%`,                               color: deductibleRatio > 0.6 ? '#10b981' : deductibleRatio > 0.3 ? '#f59e0b' : '#ef4444' },
      { label: 'Vendor Concentration', val: topVendors.length > 0 ? `${topVendorPct.toFixed(0)}%` : '—',           color: topVendorPct < 40 ? '#10b981' : topVendorPct < 60 ? '#f59e0b' : '#ef4444' },
      { label: 'Duplicate Risk',       val: potentialDuplicates.length === 0 ? 'None' : `${potentialDuplicates.length} flagged`, color: potentialDuplicates.length === 0 ? '#10b981' : '#ef4444' },
    ]

    /* ── Deductible by category ── */
    const catDed: Record<string, { ded: number; nonDed: number }> = {}
    expenses.forEach(e => {
      if (!catDed[e.category]) catDed[e.category] = { ded: 0, nonDed: 0 }
      if (e.is_deductible) catDed[e.category].ded += Number(e.amount)
      else catDed[e.category].nonDed += Number(e.amount)
    })

    /* ── Forecast ── */
    const fixedMonthly = subMonthlyTotal
    const varAvg       = Math.max(0, avgMonthlyExpenses - fixedMonthly)
    const forecast30   = fixedMonthly + varAvg
    const forecast60   = forecast30 * 2
    const forecast90   = forecast30 * 3

    return {
      totalExpenses, currentMonthExpenses, prevMonthExpenses, expGrowthPct,
      avgMonthlyExpenses, annualForecast, yearExpenses,
      deductibleTotal, deductibleRatio, estimatedTaxSavings,
      currentMonthRevenue, totalIncome, burnRate, profitMargin, netCash,
      revGrowthPct, prevRevenue,
      topCategories, largestCat, catDed, growingCats, catExp,
      topVendors, topVendorPct,
      detectedSubs, subMonthlyTotal, subAnnualTotal,
      potentialDuplicates,
      withReceipt, missingReceipt, dedMissingReceipt,
      healthScore, healthLabel, healthColor, healthFactors,
      forecast30, forecast60, forecast90,
    }
  }, [expenses, income])

  /* ── Spending Alerts ── */
  const alerts = useMemo(() => {
    const list: { level: 'danger'|'warning'|'info'; icon: string; title: string; msg: string; why: string; action?: string; onAction?: () => void }[] = []
    if (expenses.length === 0) return list
    const { expGrowthPct, potentialDuplicates, d: { missingReceipt, dedMissingReceipt, topVendorPct, topVendors, detectedSubs, subMonthlyTotal, burnRate, revGrowthPct, growingCats } } = { expGrowthPct: d.expGrowthPct, potentialDuplicates: d.potentialDuplicates, d }

    if (potentialDuplicates.length > 0)
      list.push({ level: 'danger', icon: '🔁', title: 'Potential Duplicate Charges', msg: `${potentialDuplicates.length} charge${potentialDuplicates.length > 1 ? 's' : ''} may be duplicated — same vendor, similar amount, within 7 days.`, why: 'Duplicate charges directly reduce profit and are easy to miss.', action: 'Review below' })

    if (burnRate > 70)
      list.push({ level: 'danger', icon: '🔥', title: 'High Burn Rate', msg: `Expenses at ${burnRate.toFixed(0)}% of revenue this month.`, why: 'A burn rate above 60% leaves thin profit margins and limited cash buffer.', action: 'Review categories' })

    if (expGrowthPct > 20)
      list.push({ level: 'warning', icon: '📈', title: 'Expense Spike', msg: `Expenses grew ${expGrowthPct.toFixed(0)}% vs last month.`, why: 'Fast expense growth that outpaces revenue compresses margins.', action: 'Check categories' })

    if (expGrowthPct > revGrowthPct && revGrowthPct < expGrowthPct && expenses.length > 5)
      list.push({ level: 'warning', icon: '⚠️', title: 'Expenses Growing Faster Than Revenue', msg: `Expenses +${expGrowthPct.toFixed(0)}% vs revenue +${revGrowthPct.toFixed(0)}%.`, why: 'This pattern erodes profit margin over time.', action: 'Add income' })

    if (growingCats.length > 0)
      list.push({ level: 'warning', icon: '📊', title: `${growingCats[0].cat} Spending Up ${growingCats[0].growth.toFixed(0)}%`, msg: `${growingCats[0].cat} expenses increased ${growingCats[0].growth.toFixed(0)}% this month.`, why: 'Category spikes often signal unused subscriptions or scope creep.' })

    if (topVendorPct > 45 && topVendors[0])
      list.push({ level: 'warning', icon: '🏪', title: 'Vendor Concentration', msg: `${topVendors[0].vendor} = ${topVendorPct.toFixed(0)}% of total expenses.`, why: 'High dependence on one vendor creates price and service risk.' })

    if (detectedSubs.length >= 4)
      list.push({ level: 'info', icon: '📱', title: `${detectedSubs.length} Active Subscriptions`, msg: `${detectedSubs.length} recurring services — ${fmt$(subMonthlyTotal)}/mo (${fmt$(subMonthlyTotal * 12, 0)}/yr).`, why: 'Subscription costs are easy to forget and accumulate quickly.', action: 'Review subscriptions' })

    if (dedMissingReceipt > 3)
      list.push({ level: 'info', icon: '📄', title: 'Missing Receipts on Deductible Expenses', msg: `${dedMissingReceipt} tax-deductible expense${dedMissingReceipt > 1 ? 's' : ''} have no receipt on file.`, why: 'The IRS requires documentation for deductions over $75.', action: 'Add receipts' })

    return list.slice(0, 5)
  }, [d, expenses])

  /* ── Trend chart data ── */
  const trendData = useMemo(() => buildMonthly(expenses, income, trendRange === '3m' ? 3 : trendRange === '6m' ? 6 : 12), [expenses, income, trendRange])

  /* ── Category chart data (for "Where Did My Money Go") ── */
  const categoryChartData = useMemo(() =>
    d.topCategories.slice(0, 8).map(c => ({ category: c.cat, amount: c.amt, color: c.color })),
    [d.topCategories]
  )

  /* ── Filtered expenses ── */
  const filteredExpenses = useMemo(() => {
    if (!search) return expenses
    const q = search.toLowerCase()
    return expenses.filter(e => [e.vendor, e.category, e.notes, e.business_purpose, e.linked_client].some(f => f?.toLowerCase().includes(q)))
  }, [expenses, search])

  /* ── CRUD ── */
  async function remove(id: string) {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return
    const sb = createClient()
    await sb.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
    toast.success('Deleted')
  }

  async function toggleDeductible(exp: Expense) {
    const sb = createClient()
    const newVal = !exp.is_deductible
    await sb.from('expenses').update({ is_deductible: newVal }).eq('id', exp.id)
    setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, is_deductible: newVal } : e))
    toast.success(newVal ? '✓ Marked deductible' : 'Removed deductible flag')
  }

  /* ── Exports ── */
  function exportCsv(rows: Record<string, unknown>[], filename: string) {
    if (!rows.length) { toast.error('No data to export'); return }
    const h = Object.keys(rows[0])
    const csv = [h.join(','), ...rows.map(r => h.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = filename; a.click()
    toast.success(`${filename} exported ✓`); setExportOpen(false)
  }
  const exportAll   = () => exportCsv(expenses.map(e => ({ date: e.date, vendor: e.vendor, amount: e.amount, category: e.category, deductible: e.is_deductible, subscription: !!e.is_subscription, receipt: e.receipt_ref || e.receipt_url || '', notes: e.notes || '' })), 'expenses_all.csv')
  const exportMonth = () => { const n = new Date(); exportCsv(expenses.filter(e => { const d = new Date(e.date); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() }).map(e => ({ date: e.date, vendor: e.vendor, amount: e.amount, category: e.category, deductible: e.is_deductible })), `expenses_${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}.csv`) }
  const exportDed   = () => exportCsv(expenses.filter(e => e.is_deductible).map(e => ({ date: e.date, vendor: e.vendor, amount: e.amount, category: e.category, business_purpose: e.business_purpose || '' })), 'deductible_expenses.csv')
  const exportSubs  = () => exportCsv(d.detectedSubs.map(s => ({ vendor: s.vendor, monthly: s.monthlyAvg.toFixed(2), annual: (s.monthlyAvg * 12).toFixed(2), category: s.category, months_detected: s.months })), 'subscriptions.csv')
  const exportYear  = () => { const yr = new Date().getFullYear(); exportCsv(expenses.filter(e => new Date(e.date).getFullYear() === yr).map(e => ({ date: e.date, vendor: e.vendor, amount: e.amount, category: e.category, deductible: e.is_deductible })), `expenses_${yr}.csv`) }
  const exportVendor = () => exportCsv(d.topVendors.map(v => ({ vendor: v.vendor, total: v.amt.toFixed(2), category: v.category, transactions: v.txns, pct: v.pct.toFixed(1) })), 'vendor_report.csv')
  const exportTax   = () => { const yr = new Date().getFullYear(); exportCsv(expenses.filter(e => e.is_deductible && new Date(e.date).getFullYear() === yr).map(e => ({ date: e.date, vendor: e.vendor, amount: e.amount, category: e.category, business_purpose: e.business_purpose || '' })), `tax_summary_${yr}.csv`) }

  const iStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 44, width: 280, marginBottom: 28 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          {[...Array(8)].map((_, i) => <div key={i} style={{ height: 100 }} className="skeleton" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} style={{ height: 200, marginBottom: 20 }} className="skeleton" />)}
      </div>
    )
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ══ HEADER ══ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Expenses</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Track spending, protect profit, and uncover savings opportunities.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn-primary" style={{ minHeight: 44 }} onClick={() => { setEditItem(null); setPrefillItem(null); setDrawerOpen(true) }}>+ Add Expense</button>
            <button className="btn-ghost" style={{ minHeight: 44 }} onClick={() => toast('Receipt upload via Document Vault. Open an expense to attach a receipt URL.')}>📷 Upload Receipt</button>
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" style={{ minHeight: 44 }} onClick={() => setExportOpen(s => !s)}>⬇ Export</button>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ position: 'absolute', top: '110%', right: 0, width: 210, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', zIndex: 40, padding: 8 }}>
                    {[
                      { label: 'All Expenses (CSV)',       fn: exportAll },
                      { label: 'This Month (CSV)',          fn: exportMonth },
                      { label: 'Annual Report (CSV)',       fn: exportYear },
                      { label: 'Deductible Only (CSV)',     fn: exportDed },
                      { label: 'Subscription Report (CSV)',fn: exportSubs },
                      { label: 'Vendor Report (CSV)',       fn: exportVendor },
                      { label: 'Tax Summary (CSV)',         fn: exportTax },
                      { label: 'PDF Report',               fn: () => { toast('PDF coming soon 🚀'); setExportOpen(false) } },
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
        {expenses.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ width: 88, height: 88, borderRadius: 28, background: 'linear-gradient(135deg,rgba(255,112,67,0.14),rgba(239,68,68,0.18))', border: '1.5px solid rgba(255,112,67,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, margin: '0 auto 24px', animation: 'float 3s ease-in-out infinite' }}>
              🧮
            </div>
            <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.035em', marginBottom: 10 }}>
              No expenses yet — let&apos;s keep it that way as long as possible.
            </h2>
            <p style={{ fontSize: 14, color: 'var(--mu)', lineHeight: 1.7, maxWidth: 400, margin: '0 auto 28px' }}>
              Add your first expense to unlock spending insights, tax deduction tracking, receipt storage, and savings opportunities.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-primary" style={{ padding: '13px 28px', fontSize: 14 }} onClick={() => setDrawerOpen(true)}>Add Expense</button>
              <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => toast('Receipt upload available inside each expense record.')}>Upload Receipt</button>
              <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => router.push('/vault')}>Document Vault</button>
            </div>
          </motion.div>
        )}

        {expenses.length > 0 && (
          <>
            {/* ══ 8 KPI CARDS ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Total Expenses', value: d.totalExpenses, prefix: '$', color: '#ff7043', icon: '🧮', sub: `${expenses.length} records`, tip: 'Total of all recorded expenses.' },
                { label: 'This Month', value: d.currentMonthExpenses, prefix: '$', color: '#ef4444', icon: '📅',
                  sub: expenses.length > 1 ? `${d.expGrowthPct >= 0 ? '▲' : '▼'} ${Math.abs(d.expGrowthPct).toFixed(0)}% vs last month` : undefined,
                  subColor: d.expGrowthPct <= 0 ? '#10b981' : '#ef4444', tip: 'Expenses recorded this calendar month.' },
                { label: 'Burn Rate', value: d.burnRate, prefix: '', suffix: '%', decimals: 0, color: d.burnRate < 40 ? '#10b981' : d.burnRate < 70 ? '#f59e0b' : '#ef4444', icon: '🔥',
                  sub: d.currentMonthRevenue > 0 ? `of ${fmt$(d.currentMonthRevenue, 0)} revenue` : 'Add income to calculate', tip: "Expenses as a % of this month's revenue. Below 50% is healthy." },
                { label: 'Tax Deductible', value: d.deductibleTotal, prefix: '$', color: '#10b981', icon: '✅',
                  sub: `${(d.deductibleRatio * 100).toFixed(0)}% of total`, tip: 'Expenses marked as tax-deductible. Keep this high.' },
                { label: 'Est. Tax Savings', value: d.estimatedTaxSavings, prefix: '$', color: '#8b5cf6', icon: '💡',
                  sub: 'at 25% tax rate', tip: 'Estimated tax reduction from deductible expenses (25% rate).' },
                { label: 'Largest Category', value: d.largestCat?.amt ?? 0, prefix: '$', color: '#0ea5e9', icon: '📊',
                  sub: d.largestCat?.cat ?? '—', tip: 'Your highest-spend category this period.' },
                { label: 'Subscription Total', value: d.subMonthlyTotal, prefix: '$', color: '#f59e0b', icon: '📱',
                  sub: `${d.detectedSubs.length} services · ${fmt$(d.subAnnualTotal, 0)}/yr`, tip: 'Monthly total of all detected recurring subscriptions.' },
                { label: 'Expense Health', value: d.healthScore, prefix: '', suffix: '/100', decimals: 0, color: d.healthColor, icon: '❤️',
                  sub: d.healthLabel, subColor: d.healthColor, tip: '0–100 score based on burn rate, deductibles, vendor concentration, and duplicates.' },
              ].map((s, i) => (
                <motion.div key={s.label} className="stat-card" style={{ position: 'relative' }}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <InfoIcon tip={s.tip} />
                  </div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>
                    {s.prefix}
                    <CountUp end={s.value} decimals={('decimals' in s ? (s.decimals as number) : s.prefix === '$' ? 2 : 0)} duration={1.2} separator="," />
                    {'suffix' in s && s.suffix}
                  </div>
                  {s.sub && <div className="stat-sub" style={{ color: ('subColor' in s ? s.subColor as string : undefined), marginTop: 4 }}>{s.sub}</div>}
                </motion.div>
              ))}
            </div>

            {/* ══ EXPENSE HEALTH + SPENDING ALERTS ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Expense Health Score */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Expense Health</h2>
                  <span style={{ padding: '3px 10px', borderRadius: 99, background: `${d.healthColor}18`, color: d.healthColor, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {d.healthLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                  <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                    <svg viewBox="0 0 90 90" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <circle cx="45" cy="45" r="37" fill="none" stroke="var(--bg3)" strokeWidth="8" />
                      <motion.circle cx="45" cy="45" r="37" fill="none" stroke={d.healthColor} strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 37}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 37 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 37 * (1 - d.healthScore / 100) }}
                        transition={{ duration: 1.3, ease: 'easeOut' }}
                        strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: d.healthColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
                        <CountUp end={d.healthScore} duration={1.3} />
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {d.healthFactors.map(f => (
                      <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                        <span style={{ fontSize: 11, color: 'var(--mu)' }}>{f.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: f.color }}>{f.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Spending Alerts */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 320px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Spending Alerts</h2>
                  <div className="live-dot" />
                </div>
                {alerts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>✅</span>
                    <p style={{ fontSize: 12 }}>No spending alerts. Your expense patterns look healthy.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {alerts.map((a, i) => {
                      const c = a.level === 'danger' ? '#ef4444' : a.level === 'warning' ? '#f59e0b' : '#0ea5e9'
                      return (
                        <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', borderLeft: `3px solid ${c}` }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 1 }}>{a.title}</p>
                              <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>{a.msg}</p>
                            </div>
                          </div>
                          <p style={{ fontSize: 10, color: 'var(--mu2)', marginLeft: 22, marginBottom: 4 }}>{a.why}</p>
                          {a.action && <button style={{ fontSize: 10, fontWeight: 800, color: c, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 22px' }}>{a.action} →</button>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ══ SUBSCRIPTION WATCH + RECEIPT VAULT ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Subscription Watch */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Subscription Watch</h2>
                  {d.subMonthlyTotal > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mu2)' }}>Monthly</p>
                      <p style={{ fontSize: 14, fontWeight: 900, color: '#f59e0b', fontFamily: "DM Mono, monospace" }}>{fmt$(d.subMonthlyTotal)}</p>
                    </div>
                  )}
                </div>
                {d.detectedSubs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📱</span>
                    <p style={{ fontSize: 12 }}>No recurring services detected. They appear when a vendor appears in 2+ months.</p>
                    <button className="btn-ghost" style={{ marginTop: 12, fontSize: 11 }} onClick={() => { setEditItem(null); setPrefillItem(null); setDrawerOpen(true) }}>Add Subscription →</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {d.detectedSubs.slice(0, 6).map(s => (
                        <div key={s.vendor} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 10, background: 'var(--bg3)' }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{s.vendor}</p>
                            <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 1 }}>{s.category} · {s.months} months{s.isMarked ? ' · ✓ marked' : ' · auto-detected'}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#ff7043', fontFamily: "DM Mono, monospace" }}>{fmt$(s.monthlyAvg)}/mo</p>
                            <p style={{ fontSize: 9, color: 'var(--mu2)' }}>{fmt$(s.monthlyAvg * 12, 0)}/yr</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, color: 'var(--ink)' }}>
                      💡 Audit {d.detectedSubs.length} services — cancel unused ones to save ~{fmt$(d.subAnnualTotal * 0.15, 0)}/yr.
                    </div>
                  </>
                )}
              </motion.div>

              {/* Receipt Vault */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 260px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Receipt Vault</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: 'With Receipt',         value: d.withReceipt,         color: '#10b981', icon: '✅' },
                    { label: 'Missing Receipt',      value: d.missingReceipt,      color: d.missingReceipt > 0 ? '#f59e0b' : '#10b981', icon: '📋' },
                    { label: 'Tax-Ded. w/ Receipt', value: d.withReceipt > 0 ? Math.min(expenses.filter(e => e.is_deductible).length, d.withReceipt) : 0, color: '#10b981', icon: '✓' },
                    { label: 'Ded. Missing Receipt', value: d.dedMissingReceipt,   color: d.dedMissingReceipt > 0 ? '#ef4444' : '#10b981', icon: '⚠️' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '12px', borderRadius: 12, background: 'var(--bg3)' }}>
                      <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 4 }}>{s.label}</p>
                      <p style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {d.dedMissingReceipt > 0 && (
                  <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#ef4444', fontWeight: 600, marginBottom: 12 }}>
                    🚨 {d.dedMissingReceipt} deductible expense{d.dedMissingReceipt > 1 ? 's' : ''} lack receipts — IRS risk.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" style={{ flex: 1, fontSize: 11, justifyContent: 'center' }} onClick={() => router.push('/vault')}>
                    View Vault →
                  </button>
                  <button className="btn-ghost" style={{ flex: 1, fontSize: 11, justifyContent: 'center' }} onClick={() => toast('Open an expense and add a Receipt URL to attach documentation.')}>
                    Add Receipt
                  </button>
                </div>
                <p style={{ fontSize: 10, color: 'var(--mu2)', marginTop: 10, lineHeight: 1.5, textAlign: 'center' }}>
                  OCR receipt scanning in development. Store URLs now.
                </p>
              </motion.div>
            </div>

            {/* ══ WHERE DID MY MONEY GO + VENDOR INTELLIGENCE ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Where Did My Money Go */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Where Did My Money Go?</h2>
                {categoryChartData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--mu)' }}><span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📊</span><p style={{ fontSize: 12 }}>Add expenses to see your category breakdown.</p></div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={categoryChartData} layout="vertical" margin={{ left: 4, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" horizontal={false} />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--mu)' }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                        <YAxis type="category" dataKey="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} />
                        <Tooltip formatter={(v) => [fmt$(Number(v)), 'Spent']} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, fontSize: 11 }} />
                        <Bar dataKey="amount" radius={[0, 5, 5, 0]} fill="#ff7043">
                          {categoryChartData.map((entry, i) => (
                            <g key={i}><rect x={0} y={0} width={0} height={0} fill={entry.color} /></g>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {d.topCategories.slice(0, 5).map(c => (
                        <span key={c.cat} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${c.color}15`, color: c.color, fontWeight: 700 }}>{c.cat}: {c.pct.toFixed(0)}%</span>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>

              {/* Vendor Intelligence */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 260px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.51 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 14 }}>Vendor Intelligence</h2>
                {d.topVendorPct > 45 && d.topVendors[0] && (
                  <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', marginBottom: 12, fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                    ⚠️ You spend {d.topVendorPct.toFixed(0)}% with {d.topVendors[0].vendor}.
                  </div>
                )}
                {d.topVendors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--mu)' }}><span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>🏪</span><p style={{ fontSize: 12 }}>Add expenses to see vendor breakdown.</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.topVendors.map((v, i) => (
                      <div key={v.vendor} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: v.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                          {v.vendor.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.vendor}</span>
                            <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", fontWeight: 700, color: '#ff7043', flexShrink: 0, marginLeft: 8 }}>{fmt$(v.amt)}</span>
                          </div>
                          <div className="progress-track" style={{ height: 4 }}>
                            <div className="progress-fill" style={{ width: `${v.pct}%`, background: v.color }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                            <span style={{ fontSize: 9, color: 'var(--mu)' }}>{v.category}</span>
                            <span style={{ fontSize: 9, color: 'var(--mu2)' }}>{v.pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ══ TREND CHART ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Spending Trend</h2>
                  <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Expenses vs revenue over time</p>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['3m','6m','12m'] as const).map(v => (
                    <button key={v} onClick={() => setTrendRange(v)}
                      style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, background: trendRange === v ? '#ff7043' : 'var(--bg3)', color: trendRange === v ? '#fff' : 'var(--mu)', transition: 'all 0.15s' }}>
                      {v.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {trendData.every(b => b.expenses === 0) ? (
                <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--mu)' }}>
                  <span style={{ fontSize: 32, marginBottom: 10 }}>📉</span>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>No data for this period</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="gInc2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.15} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gExp2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff7043" stopOpacity={0.22} /><stop offset="95%" stopColor="#ff7043" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="income"   name="Revenue"  stroke="#10b981" strokeWidth={2} fill="url(#gInc2)" dot={false} />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ff7043" strokeWidth={2.5} fill="url(#gExp2)" dot={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* ══ TAX DEDUCTION CENTER ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Tax Deduction Center</h2>
              {expenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px', color: 'var(--mu)' }}><p style={{ fontSize: 12 }}>Add expenses to start tracking deductions.</p></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>

                  {/* Summary */}
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      {[
                        { label: 'Deductible',     val: d.deductibleTotal,     color: '#10b981' },
                        { label: 'Non-Deductible', val: d.totalExpenses - d.deductibleTotal, color: '#ff7043' },
                        { label: 'Tax Savings',    val: d.estimatedTaxSavings, color: '#8b5cf6' },
                        { label: 'Missing Receipts on Ded.', val: d.dedMissingReceipt, color: d.dedMissingReceipt > 0 ? '#ef4444' : '#10b981', isCount: true },
                      ].map(t => (
                        <div key={t.label} style={{ padding: '12px', borderRadius: 12, background: 'var(--bg3)' }}>
                          <p style={{ fontSize: 9, color: 'var(--mu)', marginBottom: 4 }}>{t.label}</p>
                          <p style={{ fontSize: 16, fontWeight: 900, color: t.color, fontFamily: "DM Mono, monospace" }}>{'isCount' in t && t.isCount ? String(t.val) : fmt$(t.val)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="progress-track" style={{ height: 8, marginBottom: 8 }}>
                      <motion.div style={{ height: '100%', background: 'linear-gradient(90deg,#10b981,#6366f1)', borderRadius: 99 }}
                        initial={{ width: 0 }} animate={{ width: `${d.deductibleRatio * 100}%` }} transition={{ duration: 0.9 }} />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--mu)' }}>{(d.deductibleRatio * 100).toFixed(0)}% deductible · saves ~{fmt$(d.estimatedTaxSavings, 0)} in taxes</p>
                  </div>

                  {/* By category with tips */}
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu2)', marginBottom: 10 }}>Category Guidance</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {Object.entries(d.catDed)
                        .sort((a, b) => (b[1].ded + b[1].nonDed) - (a[1].ded + a[1].nonDed))
                        .slice(0, 6)
                        .map(([cat, v]) => {
                          const total = v.ded + v.nonDed
                          const pct   = total > 0 ? v.ded / total * 100 : 0
                          return (
                            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: 'var(--ink)', minWidth: 130, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cat}
                                <InfoIcon tip={CAT_TIPS[cat] ?? 'Classify correctly to maximise deductions.'} />
                              </span>
                              <div className="progress-track" style={{ flex: 1, height: 5 }}>
                                <div className="progress-fill" style={{ width: `${pct}%`, background: pct > 70 ? '#10b981' : pct > 30 ? '#f59e0b' : '#ef4444' }} />
                              </div>
                              <span style={{ fontSize: 9, color: 'var(--mu2)', minWidth: 28, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  {/* Missing deductions detection */}
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu2)', marginBottom: 10 }}>Possible Missing Deductions</p>
                    {(() => {
                      const biz = Object.entries(d.catDed).filter(([cat, v]) => v.nonDed > 50 && ['Software','Marketing','Equipment','Professional Services','Operations','Office','Travel'].includes(cat))
                      return biz.length === 0 ? (
                        <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                          ✅ No obvious missing deductions found.
                        </div>
                      ) : biz.slice(0, 3).map(([cat, v]) => (
                        <div key={cat} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 8 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>{cat}</p>
                          <p style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.5 }}>{fmt$(v.nonDed)} not marked deductible. {CAT_TIPS[cat] ?? 'May qualify as a deduction.'}</p>
                          <button onClick={() => {}} style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>Review expenses →</button>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}
            </motion.div>

            {/* ══ EXPENSE FORECAST ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Expense Forecast</h2>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Projected costs based on subscriptions and historical average</p>
              </div>
              {expenses.length < 2 ? (
                <div style={{ textAlign: 'center', padding: '28px', color: 'var(--mu)' }}><p style={{ fontSize: 12 }}>Add at least 2 months of expenses to generate a forecast.</p></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  {[
                    { period: '30 Days', value: d.forecast30, fixedPct: d.subMonthlyTotal / Math.max(1, d.forecast30) * 100 },
                    { period: '60 Days', value: d.forecast60, fixedPct: d.subMonthlyTotal * 2 / Math.max(1, d.forecast60) * 100 },
                    { period: '90 Days', value: d.forecast90, fixedPct: d.subMonthlyTotal * 3 / Math.max(1, d.forecast90) * 100 },
                    { period: 'Annual',  value: d.annualForecast, fixedPct: d.subAnnualTotal / Math.max(1, d.annualForecast) * 100 },
                  ].map(f => (
                    <div key={f.period} style={{ padding: '16px', borderRadius: 14, background: 'var(--bg3)', border: '1px solid var(--bd)' }}>
                      <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu2)', marginBottom: 6 }}>{f.period}</p>
                      <p style={{ fontSize: 20, fontWeight: 900, color: '#ff7043', fontFamily: "DM Mono, monospace", letterSpacing: '-0.03em', marginBottom: 4 }}>{fmt$(f.value, 0)}</p>
                      <div className="progress-track" style={{ marginBottom: 4 }}>
                        <div className="progress-fill" style={{ width: `${Math.min(100, f.fixedPct)}%`, background: '#f59e0b' }} />
                      </div>
                      <p style={{ fontSize: 9, color: 'var(--mu)' }}>{f.fixedPct.toFixed(0)}% fixed · {(100 - f.fixedPct).toFixed(0)}% variable</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* ══ EXPENSE LIST ══ */}
            <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.60 }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, marginRight: 'auto' }}>All Expenses</h2>
                <input className="input" style={{ width: 200, height: 34, fontSize: 12 }} placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} />
                <span style={{ fontSize: 11, color: 'var(--mu)' }}>{filteredExpenses.length} records · {fmt$(d.totalExpenses)}</span>
              </div>

              {filteredExpenses.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--mu)' }}>
                  <p style={{ fontSize: 28, marginBottom: 8 }}>🔍</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>No results</p>
                  <button className="btn-ghost" style={{ fontSize: 11, marginTop: 8 }} onClick={() => setSearch('')}>Clear search</button>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="mobile-table-hide" style={{ overflowX: 'auto' }}>
                    <table className="table-base" style={{ minWidth: 820 }}>
                      <thead>
                        <tr>
                          <th style={{ paddingLeft: 20 }}>Vendor</th>
                          <th>Category</th>
                          <th>Date</th>
                          <th>Method</th>
                          <th>Receipt</th>
                          <th>Sub</th>
                          <th style={{ textAlign: 'right', paddingRight: 20 }}>Amount</th>
                          <th style={{ paddingRight: 16, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showAll ? filteredExpenses : filteredExpenses.slice(0, 15)).map(item => (
                          <tr key={item.id}>
                            <td style={{ paddingLeft: 20 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,112,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                                  {item.is_subscription ? '🔄' : '🧮'}
                                </div>
                                <div>
                                  <p style={{ fontWeight: 600, fontSize: 13 }}>{item.vendor}</p>
                                  {item.business_purpose && <p style={{ fontSize: 10, color: 'var(--mu)' }}>{item.business_purpose}</p>}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--bg3)', color: 'var(--mu)', fontWeight: 600 }}>{item.category}</span>
                            </td>
                            <td style={{ color: 'var(--mu)', fontSize: 12 }}>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                            <td style={{ color: 'var(--mu)', fontSize: 11 }}>{item.payment_method || '—'}</td>
                            <td>
                              {item.receipt_ref || item.receipt_url
                                ? <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓</span>
                                : item.is_deductible ? <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>✗</span> : <span style={{ color: 'var(--mu2)', fontSize: 11 }}>—</span>}
                            </td>
                            <td>
                              {item.is_subscription && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 99, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 700 }}>🔄</span>}
                            </td>
                            <td style={{ textAlign: 'right', paddingRight: 20 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                <button onClick={() => toggleDeductible(item)}
                                  style={{ fontSize: 10, color: item.is_deductible ? '#10b981' : 'var(--mu)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontWeight: 700, minHeight: 28 }}>
                                  {item.is_deductible ? '✓ Ded' : 'Ded?'}
                                </button>
                                <span style={{ fontFamily: "DM Mono, monospace", fontWeight: 600, color: '#ff7043', fontSize: 12 }}>-{fmt$(Number(item.amount))}</span>
                              </div>
                            </td>
                            <td style={{ paddingRight: 12, textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button onClick={() => { setEditItem(item); setPrefillItem(null); setDrawerOpen(true) }} className="btn-ghost" style={{ padding: '4px 9px', fontSize: 11, minHeight: 32 }}>Edit</button>
                                <button onClick={() => { setPrefillItem(item); setEditItem(null); setDrawerOpen(true) }} className="btn-ghost" style={{ padding: '4px 9px', fontSize: 11, minHeight: 32 }}>Dup</button>
                                <button onClick={() => remove(item.id)} className="btn-ghost" style={{ padding: '4px 9px', fontSize: 11, color: '#ef4444', minHeight: 32 }}>Del</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredExpenses.length > 15 && (
                      <div style={{ padding: '12px 24px', borderTop: '1px solid var(--bd)' }}>
                        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowAll(s => !s)}>
                          {showAll ? 'Show less' : `Show all ${filteredExpenses.length} expenses`}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Mobile cards */}
                  <div className="mobile-cards">
                    {(showAll ? filteredExpenses : filteredExpenses.slice(0, 10)).map(item => (
                      <div key={item.id} className="mobile-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{item.vendor}</p>
                            <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>{item.category}{item.is_subscription ? ' · 🔄' : ''}</p>
                          </div>
                          <p style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, color: '#ff7043', fontSize: 15, flexShrink: 0 }}>-{fmt$(Number(item.amount))}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span style={{ fontSize: 11, color: item.is_deductible ? '#10b981' : 'var(--mu)', fontWeight: 600 }}>{item.is_deductible ? '✓ Deductible' : 'Non-ded.'}</span>
                            <span style={{ fontSize: 11, color: 'var(--mu)' }}>{new Date(item.date).toLocaleDateString()}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setEditItem(item); setPrefillItem(null); setDrawerOpen(true) }}
                              style={{ fontSize: 12, color: '#6366f1', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, minHeight: 36 }}>Edit</button>
                            <button onClick={() => remove(item.id)}
                              style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', minHeight: 36 }}>Del</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredExpenses.length > 10 && (
                      <button onClick={() => setShowAll(s => !s)} className="btn-ghost" style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
                        {showAll ? 'Show less' : `View all ${filteredExpenses.length}`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>

            {/* ══ INTEGRATIONS ══ */}
            <motion.div className="glass-card" style={{ padding: 20, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 4 }}>Connect More Data</h2>
              <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 16 }}>Import expenses automatically from your bank, cards, and payment processors.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                {[
                  { name: 'Plaid', icon: '🏦', status: 'soon' },
                  { name: 'Stripe', icon: '💳', status: 'soon' },
                  { name: 'Square', icon: '◼', status: 'soon' },
                  { name: 'Shopify', icon: '🛒', status: 'soon' },
                  { name: 'PayPal', icon: '🅿️', status: 'soon' },
                  { name: 'QuickBooks', icon: '📚', status: 'soon' },
                  { name: 'Xero', icon: '📊', status: 'soon' },
                  { name: 'Google Drive', icon: '📁', status: 'soon' },
                ].map(a => (
                  <button key={a.name} onClick={() => toast(`${a.name} integration coming soon 🚀`)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', borderRadius: 12, border: '1px solid var(--bd)', background: 'var(--bg3)', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = '1px solid #ff7043' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = '1px solid var(--bd)' }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>{a.name}</span>
                    <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coming Soon</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}

        {/* Mobile FAB */}
        <style>{`
          .expense-fab { display: none; }
          @media (max-width: 767px) {
            .expense-fab { display: flex; position: fixed; bottom: 80px; right: 20px; z-index: 50; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg,#ff7043,#ef4444); border: none; cursor: pointer; align-items: center; justify-content: center; font-size: 24px; color: #fff; box-shadow: 0 8px 24px rgba(255,112,67,0.4); }
          }
        `}</style>
        <button className="expense-fab" aria-label="Add expense" onClick={() => { setEditItem(null); setPrefillItem(null); setDrawerOpen(true) }}>+</button>

        {/* Category learn panel */}
        <AnimatePresence>
          {learnCat && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLearnCat(null)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 799 }} />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 280 }}
                className="side-drawer-panel"
                style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, padding: 24, boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{learnCat}</h3>
                  <button onClick={() => setLearnCat(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22 }}>×</button>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>{CAT_TIPS[learnCat] ?? 'Keep detailed records of all expenses in this category.'}</p>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ══ EXPENSE DRAWER ══ */}
      <ExpenseDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditItem(null); setPrefillItem(null) }}
        onSaved={item => { setExpenses(prev => [item, ...prev]); setDrawerOpen(false) }}
        onUpdated={item => { setExpenses(prev => prev.map(e => e.id === item.id ? item : e)); setDrawerOpen(false); setEditItem(null) }}
        editItem={editItem}
        prefillItem={prefillItem}
        userId={userId}
        currentMonthRevenue={d.currentMonthRevenue}
        currentMonthExpenses={d.currentMonthExpenses}
        avgMonthlyExpenses={d.avgMonthlyExpenses}
        clients={clients}
      />
    </div>
  )
}
