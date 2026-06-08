'use client'
/*
 * INCOME CENTER — Business Intelligence & Revenue Operations
 * Migration required: supabase/migrations/income_analytics.sql
 * Font names with spaces use template literals or double-quoted strings — never single-quoted.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import CountUp from 'react-countup'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Income = {
  id: string; date: string; amount: number; client_name?: string
  category: string; payment_method?: string; status: string; notes?: string
  is_recurring?: boolean; recurrence_period?: string; invoice_ref?: string; user_id?: string
}
type Expense = {
  id: string; date: string; amount: number; vendor: string
  category: string; is_deductible: boolean; status: string; user_id?: string
}
type Invoice = {
  id: string; invoice_number: string; status: string
  total?: number; balance_due?: number; due_date?: string
  paid_at?: string; created_at: string; client_name: string; user_id?: string
}
type Client = {
  id: string; name: string; total_billed: number; total_paid: number
  invoice_count: number; created_at: string; archived_at?: string
}
type GoalStore = { monthly: number; quarterly: number; annual: number }

/* ─── Constants ──────────────────────────────────────────────────────────── */
const CATEGORIES = ['Design','Development','Consulting','Photography','Retainer','E-commerce','Coaching','Writing','Marketing','Other']
const METHODS = ['Bank Transfer','Stripe','PayPal','Check','Cash','Venmo','Zelle','Other']
const RECURRENCE = ['monthly','quarterly','annual']
const TAX_RATE = 0.25
const GOALS_KEY = 'finnmgr_income_goals_v2'
const CAT_COLORS = ['#6366f1','#10b981','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#ff7043','#14b8a6','#64748b']

const DEFAULT_FORM = {
  date: new Date().toISOString().split('T')[0],
  amount: '', client_name: '', category: 'Design',
  payment_method: 'Bank Transfer', status: 'received', notes: '',
  is_recurring: false, recurrence_period: 'monthly', invoice_ref: '',
}

/* ─── Utilities ──────────────────────────────────────────────────────────── */
function fmt$(n: number, decimals = 2) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}
function fmtPct(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` }
function monthKey(d: Date) { return d.toLocaleString('default', { month: 'short', year: '2-digit' }) }

function buildMonthlyBuckets(
  income: Income[], expenses: Expense[], count: number
): { label: string; revenue: number; expenses: number; profit: number }[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const rev = income.filter(x => { const xd = new Date(x.date); return xd >= start && xd <= end })
      .reduce((s, x) => s + Number(x.amount), 0)
    const exp = expenses.filter(x => { const xd = new Date(x.date); return xd >= start && xd <= end })
      .reduce((s, x) => s + Number(x.amount), 0)
    return { label: monthKey(d), revenue: rev, expenses: exp, profit: rev - exp }
  })
}

function buildDailyBuckets(income: Income[], expenses: Expense[], days: number) {
  const now = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (days - 1 - i))
    const dStr = d.toISOString().split('T')[0]
    const rev = income.filter(x => x.date === dStr).reduce((s, x) => s + Number(x.amount), 0)
    const exp = expenses.filter(x => x.date === dStr).reduce((s, x) => s + Number(x.amount), 0)
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: rev, expenses: exp, profit: rev - exp,
    }
  })
}

/* ─── Chart tooltip ──────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 11, minWidth: 140 }}>
      <p style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{fmt$(p.value)}</strong>
        </p>
      ))}
    </div>
  )
}

/* ─── Section header ─────────────────────────────────────────────────────── */
function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{title}</h2>
        {sub && <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{sub}</p>}
      </div>
      {action}
    </div>
  )
}

/* ─── Empty mini-state ───────────────────────────────────────────────────── */
function MiniEmpty({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--mu)' }}>
      <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>{icon}</span>
      <p style={{ fontSize: 12 }}>{msg}</p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function IncomePage() {
  const router = useRouter()

  /* ── Raw data ── */
  const [income, setIncome]     = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients]   = useState<Client[]>([])

  /* ── UI state ── */
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ ...DEFAULT_FORM })
  const [trendRange, setTrendRange] = useState<'30d' | '90d' | '12m' | 'all'>('12m')
  const [exportOpen, setExportOpen] = useState(false)
  const [editGoals, setEditGoals]   = useState(false)
  const [goals, setGoals]           = useState<GoalStore>({ monthly: 0, quarterly: 0, annual: 0 })
  const [goalDraft, setGoalDraft]   = useState<GoalStore>({ monthly: 0, quarterly: 0, annual: 0 })

  /* ── Load all data in parallel ── */
  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [incRes, expRes, invRes, cliRes] = await Promise.all([
      sb.from('income').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      sb.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      sb.from('invoices').select('id,invoice_number,status,total,balance_due,due_date,paid_at,created_at,client_name')
        .eq('user_id', user.id),
      sb.from('clients').select('id,name,total_billed,total_paid,invoice_count,created_at,archived_at')
        .eq('user_id', user.id).is('archived_at', null),
    ])

    setIncome(incRes.data ?? [])
    setExpenses(expRes.data ?? [])
    setInvoices(invRes.data ?? [])
    setClients(cliRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Goals from localStorage ── */
  useEffect(() => {
    try {
      const s = localStorage.getItem(GOALS_KEY)
      if (s) { const g = JSON.parse(s); setGoals(g); setGoalDraft(g) }
    } catch {}
  }, [])

  function saveGoals() {
    setGoals(goalDraft)
    try { localStorage.setItem(GOALS_KEY, JSON.stringify(goalDraft)) } catch {}
    setEditGoals(false)
    toast.success('Goals saved ✓')
  }

  /* ════════════════════════════════════════════════════════════════════
     CENTRALISED CALCULATIONS — single useMemo for all derived values
  ════════════════════════════════════════════════════════════════════ */
  const d = useMemo(() => {
    const now = new Date()
    const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthEnd  = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const quarterStart  = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const yearStart     = new Date(now.getFullYear(), 0, 1)
    const nowMs         = now.getTime()

    /* ── Income aggregates ── */
    const totalRevenue        = income.reduce((s, i) => s + Number(i.amount), 0)
    const receivedRevenue     = income.filter(i => i.status === 'received').reduce((s, i) => s + Number(i.amount), 0)
    const pendingRevenue      = income.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0)
    const currentMonthRevenue = income.filter(i => new Date(i.date) >= monthStart)
      .reduce((s, i) => s + Number(i.amount), 0)
    const prevMonthRevenue    = income.filter(i => { const d = new Date(i.date); return d >= prevMonthStart && d <= prevMonthEnd })
      .reduce((s, i) => s + Number(i.amount), 0)
    const quarterRevenue      = income.filter(i => new Date(i.date) >= quarterStart)
      .reduce((s, i) => s + Number(i.amount), 0)
    const yearRevenue         = income.filter(i => new Date(i.date) >= yearStart)
      .reduce((s, i) => s + Number(i.amount), 0)
    const avgTransaction      = income.length > 0 ? totalRevenue / income.length : 0
    const revenueGrowthPct    = prevMonthRevenue > 0
      ? ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
      : currentMonthRevenue > 0 ? 100 : 0

    /* ── Expenses ── */
    const totalExpenses        = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const currentMonthExpenses = expenses.filter(e => new Date(e.date) >= monthStart)
      .reduce((s, e) => s + Number(e.amount), 0)
    const deductibleExpenses   = expenses.filter(e => e.is_deductible).reduce((s, e) => s + Number(e.amount), 0)

    // Avg monthly expenses (last 3 months) — for runway
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const recentExpTotal = expenses.filter(e => new Date(e.date) >= threeMonthsAgo)
      .reduce((s, e) => s + Number(e.amount), 0)
    const avgMonthlyExpenses = recentExpTotal > 0 ? recentExpTotal / 3
      : totalExpenses > 0 ? totalExpenses / Math.max(1, expenses.length > 0 ? 6 : 1) : 0

    /* ── Profit ── */
    const totalProfit     = totalRevenue - totalExpenses
    const profitMargin    = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const monthProfit     = currentMonthRevenue - currentMonthExpenses

    /* ── Cash / Runway ── */
    const netCash      = receivedRevenue - totalExpenses
    const cashRunway   = avgMonthlyExpenses > 0 ? Math.max(0, netCash / avgMonthlyExpenses) : 0

    /* ── Tax ── */
    const taxableProfit  = Math.max(0, totalProfit)
    const estimatedTax   = taxableProfit * TAX_RATE
    const federalTax     = estimatedTax * 0.75
    const stateTax       = estimatedTax * 0.25

    /* ── Tax deadlines ── */
    const yr = now.getFullYear()
    const rawDeadlines = [
      { label: 'Q1 Estimated', date: new Date(yr, 3, 15), period: 'Jan–Mar' },
      { label: 'Q2 Estimated', date: new Date(yr, 5, 15), period: 'Apr–May' },
      { label: 'Q3 Estimated', date: new Date(yr, 8, 15), period: 'Jun–Aug' },
      { label: 'Q4 Estimated', date: new Date(yr + 1, 0, 15), period: 'Sep–Dec' },
    ]
    const taxDeadlines = rawDeadlines.filter(d => d.date >= now).slice(0, 2)

    /* ── Category breakdown ── */
    const catRev: Record<string, number> = {}
    income.forEach(i => { catRev[i.category] = (catRev[i.category] ?? 0) + Number(i.amount) })
    const topCategories = Object.entries(catRev)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt], idx) => ({ cat, amt, pct: totalRevenue > 0 ? amt / totalRevenue * 100 : 0, color: CAT_COLORS[idx % CAT_COLORS.length] }))

    /* ── Category expenses for profitability ── */
    const catExp: Record<string, number> = {}
    expenses.forEach(e => { catExp[e.category] = (catExp[e.category] ?? 0) + Number(e.amount) })

    /* ── Client revenue breakdown ── */
    const clientRev: Record<string, { rev: number; txns: number; lastDate: string }> = {}
    income.forEach(i => {
      if (!i.client_name) return
      const existing = clientRev[i.client_name] ?? { rev: 0, txns: 0, lastDate: '' }
      clientRev[i.client_name] = {
        rev: existing.rev + Number(i.amount),
        txns: existing.txns + 1,
        lastDate: existing.lastDate < i.date ? i.date : existing.lastDate,
      }
    })
    const topClients = Object.entries(clientRev)
      .sort((a, b) => b[1].rev - a[1].rev)
      .slice(0, 6)
      .map(([name, v]) => ({ name, ...v, pct: totalRevenue > 0 ? v.rev / totalRevenue * 100 : 0 }))
    const topConcentration = topClients[0]?.pct ?? 0

    /* ── Recurring revenue ── */
    const recurringAll = income.filter(i => i.is_recurring === true)
    const thisMonthRecurring = recurringAll.filter(i => new Date(i.date) >= monthStart)
    const monthlyRecurring   = thisMonthRecurring.filter(i => i.recurrence_period === 'monthly')
    const quarterlyRecurring = thisMonthRecurring.filter(i => i.recurrence_period === 'quarterly')
    const annualRecurring    = thisMonthRecurring.filter(i => i.recurrence_period === 'annual')
    const mrr = monthlyRecurring.reduce((s, i) => s + Number(i.amount), 0)
      + quarterlyRecurring.reduce((s, i) => s + Number(i.amount), 0) / 3
      + annualRecurring.reduce((s, i) => s + Number(i.amount), 0) / 12
    const arr = mrr * 12

    // MoM recurring change
    const prevMonthRecurring = recurringAll.filter(i => {
      const d = new Date(i.date); return d >= prevMonthStart && d <= prevMonthEnd && i.recurrence_period === 'monthly'
    }).reduce((s, i) => s + Number(i.amount), 0)
    const mrrGrowthPct = prevMonthRecurring > 0 ? ((mrr - prevMonthRecurring) / prevMonthRecurring) * 100 : mrr > 0 ? 100 : 0

    /* ── Invoices / outstanding ── */
    const unpaidInvoices = invoices.filter(i => ['sent','overdue','viewed','partial'].includes(i.status))
    const totalOutstanding = unpaidInvoices.reduce((s, i) => s + Math.max(0, Number(i.balance_due ?? i.total ?? 0)), 0)
    const overdueInvoices  = invoices.filter(i => i.status === 'overdue')
    const paidInvoices     = invoices.filter(i => i.status === 'paid')
    const collectionRate   = invoices.filter(i => i.status !== 'draft').length > 0
      ? paidInvoices.length / invoices.filter(i => i.status !== 'draft').length * 100 : 100

    // Aging buckets by days since created_at
    const aging = {
      d0_30:  unpaidInvoices.filter(i => (nowMs - new Date(i.created_at).getTime()) / 86400000 <= 30),
      d31_60: unpaidInvoices.filter(i => { const d = (nowMs - new Date(i.created_at).getTime()) / 86400000; return d > 30 && d <= 60 }),
      d61_90: unpaidInvoices.filter(i => { const d = (nowMs - new Date(i.created_at).getTime()) / 86400000; return d > 60 && d <= 90 }),
      d90p:   unpaidInvoices.filter(i => (nowMs - new Date(i.created_at).getTime()) / 86400000 > 90),
    }
    const agingAmt = {
      d0_30:  aging.d0_30.reduce((s, i) => s + Math.max(0, Number(i.balance_due ?? i.total ?? 0)), 0),
      d31_60: aging.d31_60.reduce((s, i) => s + Math.max(0, Number(i.balance_due ?? i.total ?? 0)), 0),
      d61_90: aging.d61_90.reduce((s, i) => s + Math.max(0, Number(i.balance_due ?? i.total ?? 0)), 0),
      d90p:   aging.d90p.reduce((s, i) => s + Math.max(0, Number(i.balance_due ?? i.total ?? 0)), 0),
    }

    /* ── Revenue opportunities ── */
    const draftInvoiceValue = invoices.filter(i => i.status === 'draft')
      .reduce((s, i) => s + Number(i.total ?? 0), 0)
    // Clients with no income in last 60 days = renewal opportunity
    const sixtyDaysAgo = new Date(nowMs - 60 * 86400000)
    const recentClientNames = new Set(income.filter(i => new Date(i.date) >= sixtyDaysAgo).map(i => i.client_name))
    const dormantClients = clients.filter(c => !recentClientNames.has(c.name))
    const dormantValue = dormantClients.reduce((s, c) => s + Number(c.total_billed) / Math.max(1, c.invoice_count), 0)

    /* ── Business health score ── */
    let healthScore = 60
    if (profitMargin > 50)       healthScore += 15
    else if (profitMargin > 30)  healthScore += 8
    else if (profitMargin < 10 && income.length > 0)  healthScore -= 10
    else if (profitMargin < 0 && income.length > 0)   healthScore -= 20

    if (revenueGrowthPct > 15)   healthScore += 12
    else if (revenueGrowthPct > 5)  healthScore += 6
    else if (revenueGrowthPct < -15) healthScore -= 15
    else if (revenueGrowthPct < -5)  healthScore -= 8

    if (collectionRate > 90)     healthScore += 8
    else if (collectionRate < 60 && invoices.length > 0) healthScore -= 15

    if (topConcentration > 80)   healthScore -= 15
    else if (topConcentration > 60) healthScore -= 8
    else if (topConcentration < 40 && topClients.length >= 3) healthScore += 5

    if (cashRunway > 6)          healthScore += 8
    else if (cashRunway < 1 && income.length > 0) healthScore -= 15

    if (mrr > 0)                 healthScore += 5
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))

    const healthStatusColor = healthScore >= 70 ? '#10b981' : healthScore >= 45 ? '#f59e0b' : '#ef4444'

    /* ── Revenue health widget ── */
    let healthWidgetStatus: 'green' | 'yellow' | 'red' = 'green'
    let healthWidgetTitle = 'Healthy Growth'
    let healthWidgetDetail = ''

    if (income.length === 0) {
      healthWidgetStatus = 'yellow'
      healthWidgetTitle  = 'No Data Yet'
      healthWidgetDetail = 'Add your first income record to start tracking revenue health.'
    } else if (totalOutstanding > currentMonthRevenue * 0.5 && totalOutstanding > 500) {
      healthWidgetStatus = 'red'
      healthWidgetTitle  = 'Action Needed'
      healthWidgetDetail = `${fmt$(totalOutstanding)} in outstanding invoices exceeds 50% of this month's revenue. Prioritise collection.`
    } else if (profitMargin < 10 && income.length > 2) {
      healthWidgetStatus = 'red'
      healthWidgetTitle  = 'Action Needed'
      healthWidgetDetail = `Profit margin is ${profitMargin.toFixed(0)}% — below the healthy 15% threshold. Review expenses or increase rates.`
    } else if (topConcentration > 70) {
      healthWidgetStatus = 'yellow'
      healthWidgetTitle  = 'Monitor Closely'
      healthWidgetDetail = `${topClients[0]?.name ?? 'One client'} accounts for ${topConcentration.toFixed(0)}% of revenue — high concentration risk.`
    } else if (revenueGrowthPct < -10) {
      healthWidgetStatus = 'yellow'
      healthWidgetTitle  = 'Monitor Closely'
      healthWidgetDetail = `Revenue declined ${Math.abs(revenueGrowthPct).toFixed(0)}% vs last month. Review pipeline and re-engage inactive clients.`
    } else {
      const sign = revenueGrowthPct > 0 ? 'up' : 'down'
      const pctStr = Math.abs(revenueGrowthPct).toFixed(0)
      healthWidgetDetail = income.length > 1
        ? `Revenue ${sign} ${pctStr}% this month${profitMargin > 0 ? ` with a ${profitMargin.toFixed(0)}% profit margin` : ''}.`
        : 'Keep recording income to build a full revenue health picture.'
    }

    /* ── Health factors list ── */
    const healthFactors = [
      { label: 'Profit Margin',     val: totalRevenue > 0 ? `${profitMargin.toFixed(0)}%` : '—', color: profitMargin > 30 ? '#10b981' : profitMargin > 10 ? '#f59e0b' : '#ef4444' },
      { label: 'Revenue Trend',     val: income.length > 1 ? `${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct.toFixed(0)}%` : '—', color: revenueGrowthPct >= 0 ? '#10b981' : '#ef4444' },
      { label: 'Collection Rate',   val: invoices.length > 0 ? `${collectionRate.toFixed(0)}%` : '—', color: collectionRate > 80 ? '#10b981' : '#f59e0b' },
      { label: 'Client Diversity',  val: topClients.length > 0 ? `${topClients.length} clients` : '—', color: topClients.length >= 5 ? '#10b981' : topClients.length >= 2 ? '#f59e0b' : '#ef4444' },
      { label: 'Cash Runway',       val: income.length > 0 ? `${cashRunway.toFixed(1)} mo` : '—', color: cashRunway > 3 ? '#10b981' : cashRunway > 1 ? '#f59e0b' : '#ef4444' },
    ]

    return {
      /* Revenue */
      totalRevenue, receivedRevenue, pendingRevenue,
      currentMonthRevenue, prevMonthRevenue, revenueGrowthPct,
      quarterRevenue, yearRevenue, avgTransaction,
      /* Expenses */
      totalExpenses, currentMonthExpenses, deductibleExpenses, avgMonthlyExpenses,
      /* Profit */
      totalProfit, profitMargin, monthProfit,
      /* Cash */
      netCash, cashRunway,
      /* Tax */
      estimatedTax, federalTax, stateTax, taxableProfit, taxDeadlines,
      /* Categories */
      topCategories, catExp,
      /* Clients */
      topClients, topConcentration,
      /* Recurring */
      mrr, arr, mrrGrowthPct, recurringAll,
      /* Invoices */
      totalOutstanding, unpaidCount: unpaidInvoices.length,
      overdueCount: overdueInvoices.length, collectionRate,
      aging, agingAmt,
      /* Opportunities */
      draftInvoiceValue, dormantClients, dormantValue,
      /* Health */
      healthScore, healthStatusColor,
      healthWidgetStatus, healthWidgetTitle, healthWidgetDetail, healthFactors,
    }
  }, [income, expenses, invoices, clients])

  /* ── Coach recommendations (real data, no fake AI) ── */
  const coachRecs = useMemo(() => {
    const recs: { icon: string; msg: string; priority: 'high' | 'medium' | 'low' }[] = []
    if (income.length === 0) {
      return [{ icon: '💰', msg: 'Record your first income to unlock intelligent recommendations.', priority: 'low' as const }]
    }
    const { revenueGrowthPct, topCategories, topClients, topConcentration, totalOutstanding, profitMargin, avgTransaction, mrr, estimatedTax, cashRunway } = d

    if (revenueGrowthPct > 5)
      recs.push({ icon: '🚀', msg: `Revenue up ${revenueGrowthPct.toFixed(0)}% this month. Strong momentum — this is a good time to review your rates.`, priority: 'low' })
    else if (revenueGrowthPct < -10)
      recs.push({ icon: '⚠️', msg: `Revenue declined ${Math.abs(revenueGrowthPct).toFixed(0)}% vs last month. Review your pipeline and reach out to inactive clients.`, priority: 'high' })

    if (topCategories[0])
      recs.push({ icon: '📊', msg: `${topCategories[0].cat} generated ${topCategories[0].pct.toFixed(0)}% of your income. Consider if this dependency is intentional.`, priority: 'medium' })

    if (topConcentration > 50 && topClients[0])
      recs.push({ icon: '🎯', msg: `${topClients[0].name} represents ${topConcentration.toFixed(0)}% of total revenue — a concentration risk. Diversify your client base.`, priority: 'high' })

    if (totalOutstanding > 500)
      recs.push({ icon: '💸', msg: `${fmt$(totalOutstanding)} in outstanding invoices. Collecting these would immediately improve cash flow.`, priority: totalOutstanding > 2000 ? 'high' : 'medium' })

    if (profitMargin < 20 && income.length > 2)
      recs.push({ icon: '📉', msg: `Profit margin is ${profitMargin.toFixed(0)}% — aim for 30%+ by reviewing expenses or raising rates by 10–15%.`, priority: 'high' })
    else if (profitMargin > 50)
      recs.push({ icon: '🏆', msg: `Excellent ${profitMargin.toFixed(0)}% profit margin. Reinvest some profit into tools or marketing to accelerate growth.`, priority: 'low' })

    if (estimatedTax > 500)
      recs.push({ icon: '🧮', msg: `Set aside ${fmt$(estimatedTax)} for estimated taxes (25% of profit). Missing quarterly payments triggers IRS penalties.`, priority: 'medium' })

    if (mrr === 0 && income.length >= 5)
      recs.push({ icon: '🔄', msg: 'No recurring revenue tracked. Converting one client to a monthly retainer creates predictable cash flow.', priority: 'medium' })
    else if (mrr > 0)
      recs.push({ icon: '🔄', msg: `${fmt$(mrr, 0)}/mo MRR provides a stable base (${fmt$(mrr * 12, 0)} ARR). Growing this reduces income volatility.`, priority: 'low' })

    if (avgTransaction < 500 && income.length >= 5)
      recs.push({ icon: '💡', msg: `Average transaction is ${fmt$(avgTransaction, 0)}. Bundle services into packages to increase project value.`, priority: 'medium' })

    if (cashRunway < 2 && income.length > 0)
      recs.push({ icon: '🏦', msg: `Cash runway is ${cashRunway.toFixed(1)} months — below the recommended 3-month safety buffer. Prioritise collections.`, priority: 'high' })

    return recs.slice(0, 6)
  }, [d, income])

  /* ── Trend chart data ── */
  const trendData = useMemo(() => {
    if (trendRange === '30d') return buildDailyBuckets(income, expenses, 30)
    if (trendRange === '90d') return buildMonthlyBuckets(income, expenses, 3)
    if (trendRange === '12m') return buildMonthlyBuckets(income, expenses, 12)
    // 'all' — find earliest date
    const allDates = [...income.map(i => i.date), ...expenses.map(e => e.date)]
    if (!allDates.length) return []
    const earliest = new Date(Math.min(...allDates.map(s => new Date(s).getTime())))
    const now = new Date()
    const count = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1
    return buildMonthlyBuckets(income, expenses, Math.max(count, 1))
  }, [income, expenses, trendRange])

  /* ── Forecast ── */
  const forecast = useMemo(() => {
    const { currentMonthRevenue, revenueGrowthPct, avgMonthlyExpenses } = d
    const trend = Math.max(-0.3, Math.min(0.3, revenueGrowthPct / 100))
    const now = new Date()
    return [1, 2, 3].map(offset => {
      const dt = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const rev = currentMonthRevenue * (1 + trend) ** offset
      return {
        period: `${offset * 30}d`,
        label: dt.toLocaleString('default', { month: 'long', year: 'numeric' }),
        revenue: rev, expenses: avgMonthlyExpenses,
        balance: rev - avgMonthlyExpenses,
      }
    })
  }, [d])

  /* ── Goals progress ── */
  const goalsProgress = useMemo(() => {
    const now = new Date()
    const daysElapsed = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dailyRate = daysElapsed > 0 ? d.currentMonthRevenue / daysElapsed : 0
    return {
      monthly:   { current: d.currentMonthRevenue, target: goals.monthly, projected: dailyRate * daysInMonth },
      quarterly: { current: d.quarterRevenue,       target: goals.quarterly, projected: 0 },
      annual:    { current: d.yearRevenue,           target: goals.annual,    projected: 0 },
    }
  }, [d, goals])

  /* ── Add income ── */
  async function add(e: React.FormEvent) {
    e.preventDefault()
    const sb = createClient()
    const { error } = await sb.from('income').insert({
      user_id: userId, ...form,
      amount: parseFloat(form.amount),
      is_recurring: form.is_recurring,
      recurrence_period: form.is_recurring ? form.recurrence_period : null,
      invoice_ref: form.invoice_ref || null,
    })
    if (error) { toast.error('Failed to add income'); return }
    toast.success('Income added ✓')
    setShowForm(false)
    setForm({ ...DEFAULT_FORM })
    load()
  }

  /* ── Remove income ── */
  async function remove(id: string) {
    const sb = createClient()
    await sb.from('income').delete().eq('id', id)
    toast.success('Removed')
    setIncome(prev => prev.filter(i => i.id !== id))
  }

  /* ── CSV Export ── */
  function exportCsv(rows: Record<string, unknown>[], filename: string) {
    if (!rows.length) { toast.error('No data to export'); return }
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = filename
    a.click()
    toast.success(`${filename} exported ✓`)
    setExportOpen(false)
  }

  function exportAllIncome() {
    exportCsv(income.map(i => ({ date: i.date, client: i.client_name || '', amount: i.amount, category: i.category, method: i.payment_method || '', status: i.status, recurring: i.is_recurring || false, notes: i.notes || '' })), 'income_all.csv')
  }
  function exportThisMonth() {
    const now = new Date()
    const rows = income.filter(i => {
      const d = new Date(i.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).map(i => ({ date: i.date, client: i.client_name || '', amount: i.amount, category: i.category, status: i.status }))
    exportCsv(rows, `income_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`)
  }
  function exportYearReport() {
    const yr = new Date().getFullYear()
    const rows = income.filter(i => new Date(i.date).getFullYear() === yr)
      .map(i => ({ date: i.date, client: i.client_name || '', amount: i.amount, category: i.category }))
    exportCsv(rows, `income_${yr}.csv`)
  }
  function exportPnL() {
    const incRows = income.map(i => ({ type: 'income', date: i.date, description: i.client_name || i.category, amount: i.amount, category: i.category }))
    const expRows = expenses.map(e => ({ type: 'expense', date: e.date, description: e.vendor, amount: -e.amount, category: e.category }))
    const all = [...incRows, ...expRows].sort((a, b) => a.date.localeCompare(b.date))
    exportCsv(all, 'profit_loss.csv')
  }
  function exportTax() {
    const yr = new Date().getFullYear()
    const incRows = income.filter(i => new Date(i.date).getFullYear() === yr)
      .map(i => ({ type: 'income', date: i.date, amount: i.amount, client: i.client_name || '', category: i.category }))
    const dedRows = expenses.filter(e => e.is_deductible && new Date(e.date).getFullYear() === yr)
      .map(e => ({ type: 'deductible_expense', date: e.date, amount: e.amount, vendor: e.vendor, category: e.category }))
    exportCsv([...incRows, ...dedRows], `tax_summary_${yr}.csv`)
  }

  /* ── Shared styles ── */
  const lStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block' }
  const iStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }

  const hwColors = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444' }
  const hwBgs    = { green: 'rgba(16,185,129,0.08)', yellow: 'rgba(245,158,11,0.08)', red: 'rgba(239,68,68,0.08)' }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 44, width: 280, marginBottom: 28 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[...Array(6)].map((_, i) => <div key={i} style={{ height: 90 }} className="skeleton" />)}
        </div>
        {[...Array(4)].map((_, i) => <div key={i} style={{ height: 200, marginBottom: 20 }} className="skeleton" />)}
      </div>
    )
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Income</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Revenue operations & business intelligence.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Income</button>
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" onClick={() => setExportOpen(s => !s)}>⬇ Export</button>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    style={{ position: 'absolute', top: '110%', right: 0, width: 210, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', zIndex: 40, padding: 8 }}>
                    {[
                      { label: 'All Income (CSV)',     fn: exportAllIncome },
                      { label: 'This Month (CSV)',     fn: exportThisMonth },
                      { label: 'Annual Report (CSV)',  fn: exportYearReport },
                      { label: 'Profit & Loss (CSV)',  fn: exportPnL },
                      { label: 'Tax Summary (CSV)',    fn: exportTax },
                    ].map(x => (
                      <button key={x.label} onClick={x.fn}
                        style={{ display: 'block', width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', textAlign: 'left', borderRadius: 8, fontWeight: 500, transition: 'background 0.12s' }}
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

        {/* ══ SECTION 1 — KPI Cards ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Revenue',         value: d.totalRevenue,         prefix: '$', color: '#10b981', icon: '💰', sub: `${fmt$(d.receivedRevenue)} received` },
            { label: 'Current Month',         value: d.currentMonthRevenue,  prefix: '$', color: '#6366f1', icon: '📅',
              sub: income.length > 1 ? `${d.revenueGrowthPct >= 0 ? '▲' : '▼'} ${Math.abs(d.revenueGrowthPct).toFixed(0)}% vs last month` : 'Track monthly progress',
              subColor: d.revenueGrowthPct >= 0 ? '#10b981' : '#ef4444' },
            { label: 'Avg Transaction',       value: d.avgTransaction,        prefix: '$', color: '#0ea5e9', icon: '📊', sub: `${income.length} transactions` },
            { label: 'Profit Margin',         value: d.profitMargin,          prefix: '',  suffix: '%', color: d.profitMargin > 30 ? '#10b981' : d.profitMargin > 10 ? '#f59e0b' : '#ef4444', icon: '📈',
              sub: `${fmt$(d.totalProfit)} net profit` },
            { label: 'Cash Runway',           value: d.cashRunway,            prefix: '',  suffix: 'mo', decimals: 1, color: d.cashRunway > 3 ? '#10b981' : d.cashRunway > 1 ? '#f59e0b' : '#ef4444', icon: '🏦',
              sub: d.avgMonthlyExpenses > 0 ? `${fmt$(d.avgMonthlyExpenses, 0)}/mo avg expenses` : 'Add expenses to calculate' },
            { label: 'Tax Reserve',           value: d.estimatedTax,          prefix: '$', color: '#8b5cf6', icon: '🧮',
              sub: `est. 25% of ${fmt$(d.taxableProfit, 0)} profit` },
          ].map((s, i) => (
            <motion.div key={s.label} className="stat-card"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
              </div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>
                {s.prefix}
                <CountUp end={s.value} decimals={('decimals' in s ? s.decimals : s.prefix === '$' ? 2 : 0) as number} duration={1.2} separator="," />
                {'suffix' in s && s.suffix}
              </div>
              {s.sub && (
                <div className="stat-sub" style={{ color: ('subColor' in s ? s.subColor : undefined) as string | undefined, marginTop: 4 }}>
                  {s.sub}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* ══ SECTION 2+3 — Revenue Health + Revenue Coach ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Revenue Health Engine */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <SectionHeader title="Revenue Health" sub="Live signal based on your data" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 14, background: hwBgs[d.healthWidgetStatus], border: `1.5px solid ${hwColors[d.healthWidgetStatus]}33`, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: hwColors[d.healthWidgetStatus], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {d.healthWidgetStatus === 'green' ? '✅' : d.healthWidgetStatus === 'yellow' ? '⚠️' : '🚨'}
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 14, color: hwColors[d.healthWidgetStatus], marginBottom: 3 }}>{d.healthWidgetTitle}</p>
                <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{d.healthWidgetDetail}</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.healthFactors.map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--mu)' }}>{f.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.val}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Revenue Coach */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Revenue Coach</h2>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Data-driven recommendations</p>
              </div>
              <div className="live-dot" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {coachRecs.map((r, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', borderLeft: `3px solid ${r.priority === 'high' ? '#ef4444' : r.priority === 'medium' ? '#f59e0b' : '#10b981'}` }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                    <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{r.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ══ SECTION 4 — Revenue Trend Chart ══ */}
        <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <SectionHeader title="Revenue Analytics" sub="Revenue, expenses & profit over time" />
            <div style={{ display: 'flex', gap: 4 }}>
              {(['30d','90d','12m','all'] as const).map(v => (
                <button key={v} onClick={() => setTrendRange(v)}
                  style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, background: trendRange === v ? '#6366f1' : 'var(--bg3)', color: trendRange === v ? '#fff' : 'var(--mu)', transition: 'all 0.15s' }}>
                  {v === 'all' ? 'All' : v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {trendData.every(b => b.revenue === 0 && b.expenses === 0) ? (
            <MiniEmpty icon="📈" msg="Add income and expenses to see your revenue trend" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ff7043" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#ff7043" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke="#10b981" strokeWidth={2.5} fill="url(#gRev)" dot={false} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ff7043" strokeWidth={2} fill="url(#gExp)" dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="profit"   name="Profit"   stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* ══ SECTION 5+6 — Category Profitability + Client Revenue ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Category Profitability */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <SectionHeader title="Revenue by Category" sub="Where your income comes from" />
            {d.topCategories.length === 0 ? (
              <MiniEmpty icon="📊" msg="Add income across categories to see your breakdown" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.topCategories.slice(0, 7).map((c, i) => (
                  <div key={c.cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.cat}</span>
                      <span style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, color: c.color }}>{fmt$(c.amt)}</span>
                    </div>
                    <div className="progress-track" style={{ height: 6 }}>
                      <motion.div className="progress-fill"
                        initial={{ width: 0 }} animate={{ width: `${c.pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.05 }}
                        style={{ background: c.color }} />
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>{c.pct.toFixed(0)}% of total revenue</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Client Revenue Insights */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}>
            <SectionHeader title="Top Revenue Clients" sub="Income by client source" />
            {d.topConcentration > 60 && d.topClients[0] && (
              <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14, fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                ⚠️ {d.topConcentration.toFixed(0)}% of revenue from {d.topClients[0].name}. High concentration risk.
              </div>
            )}
            {d.topClients.length === 0 ? (
              <MiniEmpty icon="👥" msg="Add income with client names to see client revenue" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.topClients.map((c, i) => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: CAT_COLORS[i % CAT_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", fontWeight: 700, color: '#10b981', flexShrink: 0, marginLeft: 8 }}>{fmt$(c.rev)}</span>
                      </div>
                      <div className="progress-track" style={{ height: 4 }}>
                        <div className="progress-fill" style={{ width: `${c.pct}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--mu)', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>{c.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ══ SECTION 11+7 — Outstanding Aging + Recurring Revenue ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Outstanding / Aging Buckets */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <SectionHeader title="Outstanding Revenue"
              sub={d.totalOutstanding > 0 ? `${fmt$(d.totalOutstanding)} recoverable` : 'No outstanding invoices'}
              action={d.totalOutstanding > 0 ? (
                <button className="btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => router.push('/invoices')}>
                  View Invoices →
                </button>
              ) : undefined} />
            {d.unpaidCount === 0 ? (
              <MiniEmpty icon="✅" msg="All invoices are paid — great work!" />
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: '0–30 days',  amt: d.agingAmt.d0_30,  count: d.aging.d0_30.length,  color: '#10b981' },
                    { label: '31–60 days', amt: d.agingAmt.d31_60, count: d.aging.d31_60.length, color: '#f59e0b' },
                    { label: '61–90 days', amt: d.agingAmt.d61_90, count: d.aging.d61_90.length, color: '#ff7043' },
                    { label: '90+ days',   amt: d.agingAmt.d90p,   count: d.aging.d90p.length,   color: '#ef4444' },
                  ].map(b => (
                    <div key={b.label} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg3)', border: `1px solid ${b.color}22` }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: b.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{b.label}</p>
                      <p style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', fontFamily: "DM Mono, monospace" }}>{fmt$(b.amt)}</p>
                      <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>{b.count} invoice{b.count !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
                {d.aging.d90p.length > 0 && (
                  <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                    🚨 {d.aging.d90p.length} invoice{d.aging.d90p.length > 1 ? 's are' : ' is'} 90+ days overdue. Consider escalating.
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* Recurring Revenue */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
            <SectionHeader title="Recurring Revenue" sub="Monthly (MRR) and Annual (ARR)" />
            {d.recurringAll.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontSize: 32, marginBottom: 10 }}>🔄</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>No recurring income yet</p>
                <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 16 }}>Mark income as recurring when you add it to start tracking MRR/ARR.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', textAlign: 'center' }}>
                    <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1', marginBottom: 6 }}>MRR</p>
                    <p style={{ fontSize: 22, fontWeight: 900, color: '#6366f1', fontFamily: "DM Mono, monospace", letterSpacing: '-0.03em' }}>{fmt$(d.mrr)}</p>
                    {d.mrrGrowthPct !== 0 && (
                      <p style={{ fontSize: 10, color: d.mrrGrowthPct > 0 ? '#10b981' : '#ef4444', fontWeight: 700, marginTop: 4 }}>
                        {d.mrrGrowthPct > 0 ? '▲' : '▼'} {Math.abs(d.mrrGrowthPct).toFixed(0)}% vs last mo
                      </p>
                    )}
                  </div>
                  <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', textAlign: 'center' }}>
                    <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10b981', marginBottom: 6 }}>ARR</p>
                    <p style={{ fontSize: 22, fontWeight: 900, color: '#10b981', fontFamily: "DM Mono, monospace", letterSpacing: '-0.03em' }}>{fmt$(d.arr)}</p>
                    <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>MRR × 12</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {d.recurringAll.slice(0, 4).map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 8, background: 'var(--bg3)' }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{i.client_name || i.category}</p>
                        <p style={{ fontSize: 10, color: 'var(--mu)' }}>{i.recurrence_period} · {i.category}</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', fontFamily: "DM Mono, monospace" }}>{fmt$(Number(i.amount))}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* ══ SECTION 8 — Revenue Goals ══ */}
        <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}>
          <SectionHeader title="Revenue Goals"
            sub="Monthly, quarterly, and annual targets"
            action={
              <button className="btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => { setGoalDraft({ ...goals }); setEditGoals(s => !s) }}>
                {editGoals ? 'Cancel' : '✏️ Set Goals'}
              </button>
            } />

          <AnimatePresence>
            {editGoals && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: '16px 0 4px' }}>
                  {(['monthly','quarterly','annual'] as const).map(k => (
                    <div key={k}>
                      <label style={lStyle}>{k.charAt(0).toUpperCase() + k.slice(1)} Goal</label>
                      <div style={{ position: 'relative', marginTop: 6 }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 13 }}>$</span>
                        <input type="number" min="0" step="100"
                          style={{ ...iStyle, marginTop: 0, paddingLeft: 26 }}
                          value={goalDraft[k] || ''}
                          onChange={e => setGoalDraft(g => ({ ...g, [k]: parseFloat(e.target.value) || 0 }))}
                          placeholder="0" />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn-primary" style={{ marginTop: 8 }} onClick={saveGoals}>Save Goals</button>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              { key: 'monthly' as const, label: 'Monthly', color: '#6366f1' },
              { key: 'quarterly' as const, label: 'Quarterly', color: '#10b981' },
              { key: 'annual' as const, label: 'Annual', color: '#f59e0b' },
            ].map(g => {
              const gp = goalsProgress[g.key]
              const pct = gp.target > 0 ? Math.min(100, (gp.current / gp.target) * 100) : 0
              const remaining = gp.target > 0 ? Math.max(0, gp.target - gp.current) : 0
              return (
                <div key={g.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{g.label}</span>
                    <span style={{ color: g.color, fontWeight: 800, fontFamily: "DM Mono, monospace" }}>
                      {gp.target > 0 ? `${fmt$(gp.current, 0)} / ${fmt$(gp.target, 0)}` : 'No target set'}
                    </span>
                  </div>
                  <div className="progress-track" style={{ marginBottom: 5 }}>
                    <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9 }} style={{ background: g.color }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--mu)' }}>
                    <span>{pct.toFixed(0)}% complete</span>
                    {remaining > 0 && <span>{fmt$(remaining, 0)} to go</span>}
                    {g.key === 'monthly' && gp.target > 0 && goalsProgress.monthly.projected > 0 && (
                      <span style={{ color: goalsProgress.monthly.projected >= gp.target ? '#10b981' : '#f59e0b' }}>
                        proj. {fmt$(goalsProgress.monthly.projected, 0)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ══ SECTION 9 — Cash Flow Forecast ══ */}
        <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56 }}>
          <SectionHeader title="Cash Flow Forecast" sub="30/60/90-day projections based on trend" />
          {income.length < 2 ? (
            <MiniEmpty icon="🔮" msg="Add at least 2 months of income to generate a forecast" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {forecast.map(f => {
                const balColor = f.balance > 0 ? '#10b981' : '#ef4444'
                return (
                  <div key={f.period} style={{ padding: 18, borderRadius: 14, background: 'var(--bg3)', border: '1px solid var(--bd)' }}>
                    <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)', marginBottom: 4 }}>{f.period}</p>
                    <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12 }}>{f.label}</p>
                    {[
                      { label: 'Proj. Revenue',  val: f.revenue,  color: '#10b981' },
                      { label: 'Est. Expenses',  val: f.expenses, color: '#ff7043' },
                      { label: 'Proj. Balance',  val: f.balance,  color: balColor },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--mu)' }}>{r.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: r.color, fontFamily: "DM Mono, monospace" }}>{fmt$(r.val)}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 8, background: f.balance >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', textAlign: 'center' }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: balColor }}>{f.balance >= 0 ? 'Positive' : 'Negative'} Cash Flow</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 12 }}>
            ⚠️ Forecasts are projections based on historical trend — not financial advice.
          </p>
        </motion.div>

        {/* ══ SECTION 10 — Tax Intelligence ══ */}
        <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}>
          <SectionHeader title="Tax Planning Center" sub="Estimated liability based on your profit" />
          {income.length === 0 ? (
            <MiniEmpty icon="🧮" msg="Add income to see your estimated tax liability" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: 'Est. Total Tax',  val: d.estimatedTax,  color: '#8b5cf6', note: '25% self-employment' },
                    { label: 'Federal (est.)',   val: d.federalTax,    color: '#6366f1', note: '~75% of total' },
                    { label: 'State (est.)',     val: d.stateTax,      color: '#ec4899', note: '~25% of total' },
                    { label: 'Taxable Profit',  val: d.taxableProfit,  color: '#10b981', note: 'Revenue minus expenses' },
                  ].map(t => (
                    <div key={t.label} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg3)' }}>
                      <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 4 }}>{t.label}</p>
                      <p style={{ fontSize: 16, fontWeight: 900, color: t.color, fontFamily: "DM Mono, monospace" }}>{fmt$(t.val)}</p>
                      <p style={{ fontSize: 9, color: 'var(--mu2)', marginTop: 3 }}>{t.note}</p>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 3 }}>Deductible Expenses</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#8b5cf6', fontFamily: "DM Mono, monospace" }}>{fmt$(d.deductibleExpenses)}</p>
                  <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>reduces your taxable income</p>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu2)', marginBottom: 10 }}>Upcoming Deadlines</p>
                {d.taxDeadlines.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--mu)' }}>No upcoming quarterly deadlines.</p>
                ) : (
                  d.taxDeadlines.map((td, i) => {
                    const daysLeft = Math.ceil((td.date.getTime() - Date.now()) / 86400000)
                    return (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg3)', marginBottom: 10, border: `1px solid ${daysLeft < 30 ? 'rgba(245,158,11,0.3)' : 'var(--bd)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{td.label}</p>
                            <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>{td.period}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: daysLeft < 30 ? '#f59e0b' : 'var(--mu)' }}>{daysLeft} days</p>
                            <p style={{ fontSize: 10, color: 'var(--mu2)', marginTop: 1 }}>{td.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, color: 'var(--ink)', lineHeight: 1.6 }}>
                  💡 Set aside <strong>{fmt$(d.estimatedTax / 4)}</strong> per quarter to avoid underpayment penalties. Consult a tax professional for exact amounts.
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ══ SECTION 12 — Revenue Opportunities ══ */}
        <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <SectionHeader title="Revenue Opportunities" sub="Potential and pending revenue pipeline" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[
              { label: 'Outstanding Invoices', val: d.totalOutstanding,  icon: '📤', color: '#f59e0b', note: `${d.unpaidCount} unpaid invoice${d.unpaidCount !== 1 ? 's' : ''}`,         action: 'View Invoices', href: '/invoices' },
              { label: 'Draft Invoice Value',  val: d.draftInvoiceValue, icon: '📝', color: '#6366f1', note: 'Ready to send',                                                              action: 'View Drafts',  href: '/invoices' },
              { label: 'Dormant Clients',      val: d.dormantValue,      icon: '😴', color: '#0ea5e9', note: `${d.dormantClients.length} client${d.dormantClients.length !== 1 ? 's' : ''} inactive 60+ days`, action: 'View Clients', href: '/clients' },
            ].map(o => (
              <div key={o.label} style={{ padding: '16px 18px', borderRadius: 14, background: 'var(--bg3)', border: `1px solid ${o.color}22` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>{o.icon}</span>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{o.label}</p>
                </div>
                <p style={{ fontSize: 22, fontWeight: 900, color: o.color, fontFamily: "DM Mono, monospace", letterSpacing: '-0.03em', marginBottom: 4 }}>
                  {o.val > 0 ? fmt$(o.val) : '—'}
                </p>
                <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 10 }}>{o.note}</p>
                <button className="btn-ghost" style={{ fontSize: 11, padding: '5px 12px', width: '100%', justifyContent: 'center' }}
                  onClick={() => router.push(o.href)}>
                  {o.action} →
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ══ SECTION 13 — Business Health Score ══ */}
        <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}>
          <SectionHeader title="Business Health Score" sub="Composite score from 5 financial factors" />
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 28, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 140, height: 140 }}>
              <svg viewBox="0 0 140 140" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="70" cy="70" r="58" fill="none" stroke="var(--bg3)" strokeWidth="12" />
                <motion.circle cx="70" cy="70" r="58" fill="none"
                  stroke={d.healthStatusColor} strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 58}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - d.healthScore / 100) }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                  strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 30, fontWeight: 900, color: d.healthStatusColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
                  <CountUp end={d.healthScore} duration={1.5} />
                </span>
                <span style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>/100</span>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: d.healthStatusColor, marginBottom: 6 }}>
                {d.healthScore >= 70 ? 'Healthy Business' : d.healthScore >= 45 ? 'Needs Attention' : 'Critical Action Required'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 14 }}>
                {d.healthScore >= 70 ? 'Your business fundamentals look solid. Keep growing.' : d.healthScore >= 45 ? 'Review profitability, collections, and client concentration.' : 'Immediate action needed — review expenses, outstanding invoices, and revenue diversity.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {d.healthFactors.map(f => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--mu)' }}>{f.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ══ SECTION 14 — Download Center ══ */}
        <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.64 }}>
          <SectionHeader title="Download Center" sub="Export your financial data" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {[
              { label: 'All Income',      icon: '💰', desc: 'Complete income history',   fn: exportAllIncome, available: true },
              { label: 'This Month',      icon: '📅', desc: 'Current month income',       fn: exportThisMonth, available: true },
              { label: 'Annual Report',   icon: '📆', desc: `${new Date().getFullYear()} income`,        fn: exportYearReport, available: true },
              { label: 'Profit & Loss',   icon: '📊', desc: 'Income & expenses combined', fn: exportPnL, available: true },
              { label: 'Tax Summary',     icon: '🧮', desc: 'Income + deductibles',       fn: exportTax, available: true },
              { label: 'PDF Report',      icon: '📄', desc: 'Coming soon',               fn: () => toast('PDF export coming soon 🚀'), available: false },
            ].map(x => (
              <button key={x.label} onClick={x.fn}
                style={{ padding: '14px 16px', borderRadius: 12, background: x.available ? 'var(--bg3)' : 'var(--bg3)', border: `1px solid ${x.available ? 'var(--bd)' : 'var(--bd)'}`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', opacity: x.available ? 1 : 0.55 }}
                onMouseEnter={e => { if (x.available) (e.currentTarget as HTMLButtonElement).style.border = '1px solid #6366f1' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = '1px solid var(--bd)' }}>
                <span style={{ fontSize: 20, display: 'block', marginBottom: 6 }}>{x.icon}</span>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{x.label}</p>
                <p style={{ fontSize: 10, color: 'var(--mu)' }}>{x.desc}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ══ EXISTING INCOME TABLE (kept exactly) ══ */}
        <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.66 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800 }}>All Income</h2>
            <span style={{ fontSize: 11, color: 'var(--mu)' }}>{income.length} records · {fmt$(d.totalRevenue)} total</span>
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.form
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                onSubmit={add} style={{ padding: '20px 24px', borderBottom: '1px solid var(--bd)', background: 'rgba(99,102,241,0.04)', overflow: 'hidden' }}>
                <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={lStyle}>Client / Source</label>
                    <input className="input" style={{ marginTop: 6 }} value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Acme Corp" />
                  </div>
                  <div>
                    <label style={lStyle}>Amount ($)</label>
                    <input className="input" style={{ marginTop: 6 }} type="number" min="0" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <label style={lStyle}>Date</label>
                    <input className="input" style={{ marginTop: 6 }} type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lStyle}>Category</label>
                    <select className="input" style={{ marginTop: 6 }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Payment Method</label>
                    <select className="input" style={{ marginTop: 6 }} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                      {METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Status</label>
                    <select className="input" style={{ marginTop: 6 }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="received">Received</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Invoice Ref. (optional)</label>
                    <input className="input" style={{ marginTop: 6 }} value={form.invoice_ref} onChange={e => setForm(f => ({ ...f, invoice_ref: e.target.value }))} placeholder="INV-001" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                      <input type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} />
                      Recurring income
                    </label>
                  </div>
                  {form.is_recurring && (
                    <div>
                      <label style={lStyle}>Recurrence</label>
                      <select className="input" style={{ marginTop: 6 }} value={form.recurrence_period} onChange={e => setForm(f => ({ ...f, recurrence_period: e.target.value }))}>
                        {RECURRENCE.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label style={lStyle}>Notes (optional)</label>
                  <input className="input" style={{ marginTop: 6, marginBottom: 12 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Project details, PO number, etc." />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn-primary">Save income</button>
                  <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setForm({ ...DEFAULT_FORM }) }}>Cancel</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {income.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">💰</span>
              <h3>Let&apos;s record your first win</h3>
              <p>Every dollar matters. Track your income here and watch your business grow.</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>Add income →</button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="mobile-table-hide">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24 }}>Source</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Ref</th>
                      <th style={{ textAlign: 'right', paddingRight: 24 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {income.map(item => (
                      <tr key={item.id} className="group">
                        <td style={{ paddingLeft: 24 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                              {item.is_recurring ? '🔄' : '💰'}
                            </div>
                            <div>
                              <span style={{ fontWeight: 500 }}>{item.client_name || '—'}</span>
                              {item.notes && <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 1 }}>{item.notes}</p>}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--mu)', fontSize: 12 }}>{item.category}</td>
                        <td style={{ color: 'var(--mu)', fontSize: 12 }}>{new Date(item.date).toLocaleDateString()}</td>
                        <td><span className={`status-pill status-${item.status}`}>{item.status}</span></td>
                        <td style={{ color: 'var(--mu2)', fontSize: 11 }}>{item.invoice_ref || '—'}</td>
                        <td style={{ textAlign: 'right', paddingRight: 24 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                            <span style={{ fontFamily: "DM Mono, monospace", fontWeight: 600, color: '#10b981' }}>+{fmt$(Number(item.amount))}</span>
                            <button onClick={() => remove(item.id)} style={{ opacity: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, padding: '2px 6px', borderRadius: 6 }} className="del-btn">✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="mobile-cards">
                {income.map(item => (
                  <div key={item.id} className="mobile-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{item.client_name || '—'}</p>
                        <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>{item.category}{item.is_recurring ? ' · 🔄 Recurring' : ''}</p>
                      </div>
                      <p style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, color: '#10b981', fontSize: 15 }}>+{fmt$(Number(item.amount))}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`status-pill status-${item.status}`}>{item.status}</span>
                        <span style={{ fontSize: 11, color: 'var(--mu)' }}>{new Date(item.date).toLocaleDateString()}</span>
                      </div>
                      <button onClick={() => remove(item.id)}
                        style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

      </motion.div>
      <style>{`.group:hover .del-btn { opacity: 1 !important; }`}</style>
    </div>
  )
}
