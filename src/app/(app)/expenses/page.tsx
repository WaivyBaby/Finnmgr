'use client'
/*
 * PROFIT PROTECTION CENTER — Expense Intelligence & Cost Optimization
 * Migration required: supabase/migrations/expense_analytics.sql
 * Font names with spaces use template literals or double-quoted strings — never single-quoted.
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
  id: string; date: string; amount: number; vendor: string
  category: string; payment_method?: string; is_deductible: boolean
  status: string; notes?: string; is_subscription?: boolean
  subscription_period?: string; receipt_ref?: string; user_id?: string
}
type IncomeRow = { amount: number; date: string }

/* ─── Constants ──────────────────────────────────────────────────────────── */
const CATEGORIES = ['Operations','Software','Marketing','Payroll','Office','Travel','Meals','Equipment','Professional Services','Insurance','Rent','Utilities','Other']
const METHODS     = ['Bank Transfer','Credit Card','PayPal','Check','Cash','Other']
const RECURRENCE  = ['monthly','quarterly','annual']
const CAT_COLORS  = ['#6366f1','#ff7043','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#10b981','#14b8a6','#64748b','#f97316','#84cc16','#a78bfa']

const DEFAULT_FORM = {
  date: new Date().toISOString().split('T')[0],
  amount: '', vendor: '', category: 'Operations',
  payment_method: 'Bank Transfer', is_deductible: true, status: 'paid',
  notes: '', is_subscription: false, subscription_period: 'monthly', receipt_ref: '',
}

/* ─── Utilities ──────────────────────────────────────────────────────────── */
function fmt$(n: number, dec = 2) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}

function buildMonthlyExpenses(
  expenses: Expense[], income: IncomeRow[], count: number
): { label: string; expenses: number; income: number; net: number }[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const exp = expenses.filter(x => { const xd = new Date(x.date); return xd >= d && xd <= end })
      .reduce((s, x) => s + Number(x.amount), 0)
    const inc = income.filter(x => { const xd = new Date(x.date); return xd >= d && xd <= end })
      .reduce((s, x) => s + Number(x.amount), 0)
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    return { label, expenses: exp, income: inc, net: inc - exp }
  })
}

function buildDailyExpenses(expenses: Expense[], income: IncomeRow[], days: number) {
  const now = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (days - 1 - i))
    const dStr = d.toISOString().split('T')[0]
    const exp = expenses.filter(x => x.date === dStr).reduce((s, x) => s + Number(x.amount), 0)
    const inc = income.filter(x => x.date === dStr).reduce((s, x) => s + Number(x.amount), 0)
    return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), expenses: exp, income: inc, net: inc - exp }
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
      {payload.map(p => <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>{p.name}: <strong>{fmt$(p.value)}</strong></p>)}
    </div>
  )
}

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
export default function ExpensesPage() {
  const router = useRouter()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [income, setIncome]     = useState<IncomeRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ ...DEFAULT_FORM })
  const [trendRange, setTrendRange] = useState<'30d' | '90d' | '12m' | 'all'>('12m')
  const [exportOpen, setExportOpen] = useState(false)

  /* ── Load in parallel ── */
  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [expRes, incRes] = await Promise.all([
      sb.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      sb.from('income').select('amount,date').eq('user_id', user.id),
    ])
    setExpenses(expRes.data ?? [])
    setIncome(incRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ════════════════════════════════════════════════════════════════════
     CENTRALISED CALCULATIONS
  ════════════════════════════════════════════════════════════════════ */
  const d = useMemo(() => {
    const now     = new Date()
    const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevStart     = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevEnd       = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const yearStart     = new Date(now.getFullYear(), 0, 1)
    const nowMs         = now.getTime()

    /* ── Expense aggregates ── */
    const totalExpenses        = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const currentMonthExpenses = expenses.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + Number(e.amount), 0)
    const prevMonthExpenses    = expenses.filter(e => { const d = new Date(e.date); return d >= prevStart && d <= prevEnd }).reduce((s, e) => s + Number(e.amount), 0)
    const yearExpenses         = expenses.filter(e => new Date(e.date) >= yearStart).reduce((s, e) => s + Number(e.amount), 0)
    const recentThreeMonths    = expenses.filter(e => new Date(e.date) >= threeMonthsAgo).reduce((s, e) => s + Number(e.amount), 0)
    const avgMonthlyExpenses   = recentThreeMonths > 0 ? recentThreeMonths / 3 : totalExpenses > 0 ? totalExpenses / 6 : 0
    const expGrowthPct         = prevMonthExpenses > 0 ? ((currentMonthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100 : currentMonthExpenses > 0 ? 100 : 0

    /* ── Deductible ── */
    const deductibleTotal    = expenses.filter(e => e.is_deductible).reduce((s, e) => s + Number(e.amount), 0)
    const nonDeductibleTotal = totalExpenses - deductibleTotal
    const deductibleRatio    = totalExpenses > 0 ? deductibleTotal / totalExpenses : 0

    /* ── Annual forecast ── */
    const monthsWithData  = Math.max(1, new Set(expenses.map(e => e.date.substring(0, 7))).size)
    const annualForecast  = totalExpenses > 0 ? (totalExpenses / monthsWithData) * 12 : 0

    /* ── Income side (for burn rate) ── */
    const currentMonthIncome = income.filter(i => new Date(i.date) >= monthStart).reduce((s, i) => s + Number(i.amount), 0)
    const totalIncome        = income.reduce((s, i) => s + Number(i.amount), 0)
    const burnRate           = currentMonthIncome > 0 ? (currentMonthExpenses / currentMonthIncome) * 100 : expenses.length > 0 ? 60 : 0

    /* ── Category breakdown ── */
    const catExp: Record<string, number> = {}
    expenses.forEach(e => { catExp[e.category] = (catExp[e.category] ?? 0) + Number(e.amount) })
    const topCategories = Object.entries(catExp)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt], idx) => ({
        cat, amt, idx,
        pct: totalExpenses > 0 ? amt / totalExpenses * 100 : 0,
        color: CAT_COLORS[idx % CAT_COLORS.length],
      }))

    /* ── Deductible by category ── */
    const catDeductible: Record<string, { ded: number; nonDed: number }> = {}
    expenses.forEach(e => {
      if (!catDeductible[e.category]) catDeductible[e.category] = { ded: 0, nonDed: 0 }
      if (e.is_deductible) catDeductible[e.category].ded += Number(e.amount)
      else catDeductible[e.category].nonDed += Number(e.amount)
    })

    /* ── Vendor breakdown ── */
    const vendorExp: Record<string, { amt: number; txns: number; category: string }> = {}
    expenses.forEach(e => {
      const key = e.vendor
      if (!vendorExp[key]) vendorExp[key] = { amt: 0, txns: 0, category: e.category }
      vendorExp[key].amt += Number(e.amount)
      vendorExp[key].txns++
      vendorExp[key].category = e.category
    })
    const topVendors = Object.entries(vendorExp)
      .sort((a, b) => b[1].amt - a[1].amt)
      .slice(0, 6)
      .map(([vendor, v], idx) => ({
        vendor, ...v,
        pct: totalExpenses > 0 ? v.amt / totalExpenses * 100 : 0,
        color: CAT_COLORS[idx % CAT_COLORS.length],
      }))
    const topVendorPct = topVendors[0]?.pct ?? 0

    /* ── Subscription detection ── */
    const vendorMonths: Record<string, { months: Set<string>; amounts: number[]; category: string }> = {}
    expenses.forEach(e => {
      const key = e.vendor.toLowerCase().trim()
      if (!vendorMonths[key]) vendorMonths[key] = { months: new Set(), amounts: [], category: e.category }
      vendorMonths[key].months.add(e.date.substring(0, 7))
      vendorMonths[key].amounts.push(Number(e.amount))
      vendorMonths[key].category = e.category
    })
    const detectedSubscriptions = Object.entries(vendorMonths)
      .filter(([_, v]) => v.months.size >= 2)
      .map(([vendor, v]) => {
        const avg = v.amounts.reduce((s, a) => s + a, 0) / v.amounts.length
        const variance = v.amounts.map(a => (a - avg) ** 2).reduce((s, x) => s + x, 0) / v.amounts.length
        const cv = avg > 0 ? Math.sqrt(variance) / avg : 1
        return { vendor, monthlyAvg: avg, months: v.months.size, category: v.category, consistency: cv }
      })
      .filter(s => s.consistency < 0.25)
      .sort((a, b) => b.monthlyAvg - a.monthlyAvg)
      .slice(0, 8)
    const subscriptionMonthlyTotal = detectedSubscriptions.reduce((s, x) => s + x.monthlyAvg, 0)

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
        const j = i + 1
        const daysDiff = Math.abs(new Date(sorted[i].date).getTime() - new Date(sorted[j].date).getTime()) / 86400000
        if (daysDiff > 7) continue
        const a1 = Number(sorted[i].amount), a2 = Number(sorted[j].amount)
        if (a1 > 0 && Math.abs(a1 - a2) / Math.max(a1, a2) <= 0.05) {
          potentialDuplicates.push({ e1: sorted[i], e2: sorted[j], daysDiff: Math.round(daysDiff) })
        }
      }
    })

    /* ── MoM category growth ── */
    const catByMonth: Record<string, Record<string, number>> = {}
    expenses.forEach(e => {
      const mo = e.date.substring(0, 7)
      if (!catByMonth[mo]) catByMonth[mo] = {}
      catByMonth[mo][e.category] = (catByMonth[mo][e.category] ?? 0) + Number(e.amount)
    })
    const currMoKey = monthStart.toISOString().substring(0, 7)
    const prevMoKey = prevStart.toISOString().substring(0, 7)
    const currMoCats = catByMonth[currMoKey] ?? {}
    const prevMoCats = catByMonth[prevMoKey] ?? {}
    const growingCategories = Object.entries(currMoCats)
      .map(([cat, curr]) => {
        const prev = prevMoCats[cat] ?? 0
        const growth = prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0
        return { cat, curr, prev, growth }
      })
      .filter(c => c.growth > 15)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 4)

    /* ── Expense Health Score ── */
    let healthScore = 65
    if (burnRate > 90)        healthScore -= 25
    else if (burnRate > 70)   healthScore -= 15
    else if (burnRate > 50)   healthScore -= 8
    else if (burnRate < 30 && expenses.length > 0) healthScore += 10
    else if (burnRate < 40)   healthScore += 5

    if (expGrowthPct > 30)    healthScore -= 15
    else if (expGrowthPct > 15) healthScore -= 8
    else if (expGrowthPct < 0)  healthScore += 8
    else if (expGrowthPct < 5)  healthScore += 3

    if (topVendorPct > 60)    healthScore -= 12
    else if (topVendorPct > 40) healthScore -= 6

    if (deductibleRatio < 0.3 && expenses.length > 3) healthScore -= 10
    else if (deductibleRatio > 0.7)                    healthScore += 5

    healthScore -= Math.min(15, potentialDuplicates.length * 5)
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))
    const healthColor = healthScore >= 70 ? '#10b981' : healthScore >= 45 ? '#f59e0b' : '#ef4444'

    /* ── Health widget status ── */
    let hwStatus: 'green' | 'yellow' | 'red' = 'green'
    let hwTitle  = 'Spending Well Managed'
    let hwDetail = ''

    if (expenses.length === 0) {
      hwStatus = 'yellow'; hwTitle = 'No Data Yet'
      hwDetail = 'Add your first expense to start tracking spend health.'
    } else if (burnRate > 80) {
      hwStatus = 'red'; hwTitle = 'Action Needed'
      hwDetail = `Expenses consuming ${burnRate.toFixed(0)}% of revenue. Immediate cost review required to protect profitability.`
    } else if (potentialDuplicates.length > 0) {
      hwStatus = 'red'; hwTitle = 'Action Needed'
      hwDetail = `${potentialDuplicates.length} potential duplicate charge${potentialDuplicates.length > 1 ? 's' : ''} detected. Review and dispute if needed.`
    } else if (expGrowthPct > 25) {
      hwStatus = 'yellow'; hwTitle = 'Monitor Closely'
      hwDetail = `Expenses grew ${expGrowthPct.toFixed(0)}% vs last month. Identify the driver before it compounds.`
    } else if (deductibleRatio < 0.35 && expenses.length > 3) {
      hwStatus = 'yellow'; hwTitle = 'Monitor Closely'
      hwDetail = `Only ${(deductibleRatio * 100).toFixed(0)}% of expenses are tax-deductible. Review and reclassify to reduce tax liability.`
    } else {
      const burnLabel = burnRate < 40 ? 'efficient' : 'reasonable'
      hwDetail = expenses.length > 1
        ? `Burn rate at ${burnRate.toFixed(0)}% of revenue — ${burnLabel}. Deductible ratio: ${(deductibleRatio * 100).toFixed(0)}%.`
        : 'Keep recording expenses to build a full spend health picture.'
    }

    const hwColors = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444' }
    const hwBgs    = { green: 'rgba(16,185,129,0.08)', yellow: 'rgba(245,158,11,0.08)', red: 'rgba(239,68,68,0.08)' }

    const healthFactors = [
      { label: 'Burn Rate',          val: expenses.length > 0 ? `${burnRate.toFixed(0)}%` : '—',    color: burnRate < 40 ? '#10b981' : burnRate < 70 ? '#f59e0b' : '#ef4444' },
      { label: 'MoM Change',         val: expenses.length > 1 ? `${expGrowthPct >= 0 ? '+' : ''}${expGrowthPct.toFixed(0)}%` : '—', color: expGrowthPct <= 0 ? '#10b981' : expGrowthPct <= 15 ? '#f59e0b' : '#ef4444' },
      { label: 'Deductible Ratio',   val: expenses.length > 0 ? `${(deductibleRatio * 100).toFixed(0)}%` : '—', color: deductibleRatio > 0.6 ? '#10b981' : deductibleRatio > 0.3 ? '#f59e0b' : '#ef4444' },
      { label: 'Vendor Concentration',val: topVendors.length > 0 ? `${topVendorPct.toFixed(0)}%` : '—', color: topVendorPct < 40 ? '#10b981' : topVendorPct < 60 ? '#f59e0b' : '#ef4444' },
      { label: 'Duplicate Risk',     val: potentialDuplicates.length === 0 ? 'None' : `${potentialDuplicates.length} flagged`, color: potentialDuplicates.length === 0 ? '#10b981' : '#ef4444' },
    ]

    /* ── Savings opportunities ── */
    const savingsOpps: { icon: string; title: string; detail: string; value: number }[] = []

    // Duplicate charges
    if (potentialDuplicates.length > 0) {
      const dupeValue = potentialDuplicates.reduce((s, d) => s + Number(d.e2.amount), 0)
      savingsOpps.push({ icon: '🔁', title: 'Potential Duplicate Charges', detail: `${potentialDuplicates.length} charge${potentialDuplicates.length > 1 ? 's' : ''} may be duplicated`, value: dupeValue })
    }
    // Non-deductible business categories
    const nonDedBiz = expenses.filter(e => !e.is_deductible && ['Software','Marketing','Equipment','Professional Services','Operations','Office'].includes(e.category))
    if (nonDedBiz.length > 0) {
      const nonDedBizAmt = nonDedBiz.reduce((s, e) => s + Number(e.amount), 0)
      savingsOpps.push({ icon: '🧾', title: 'Potentially Misclassified Deductions', detail: `${fmt$(nonDedBizAmt)} in business categories not marked deductible`, value: nonDedBizAmt * 0.25 })
    }
    // Subscription audit
    if (detectedSubscriptions.length >= 4) {
      savingsOpps.push({ icon: '📱', title: 'Subscription Audit Recommended', detail: `${detectedSubscriptions.length} recurring services totaling ${fmt$(subscriptionMonthlyTotal)}/mo`, value: subscriptionMonthlyTotal * 0.2 })
    }
    // High burn rate
    if (burnRate > 60 && currentMonthIncome > 0) {
      const targetExpenses = currentMonthIncome * 0.5
      const excessSpend = Math.max(0, currentMonthExpenses - targetExpenses)
      if (excessSpend > 100) savingsOpps.push({ icon: '📉', title: 'Reduce to 50% Burn Rate', detail: `Cut ${fmt$(excessSpend)} to reach a healthy 50% expense-to-revenue ratio`, value: excessSpend })
    }

    return {
      totalExpenses, currentMonthExpenses, prevMonthExpenses,
      avgMonthlyExpenses, expGrowthPct, yearExpenses, annualForecast,
      deductibleTotal, nonDeductibleTotal, deductibleRatio,
      currentMonthIncome, totalIncome, burnRate,
      topCategories, topVendors, topVendorPct,
      catDeductible, growingCategories,
      detectedSubscriptions, subscriptionMonthlyTotal,
      potentialDuplicates,
      healthScore, healthColor,
      hwStatus, hwTitle, hwDetail, hwColors, hwBgs, healthFactors,
      savingsOpps,
    }
  }, [expenses, income])

  /* ── Expense Coach recommendations ── */
  const coachRecs = useMemo(() => {
    const recs: { icon: string; msg: string; priority: 'high' | 'medium' | 'low' }[] = []
    if (expenses.length === 0) {
      return [{ icon: '🧮', msg: 'Record your first expense to unlock profit protection insights.', priority: 'low' as const }]
    }
    const { burnRate, expGrowthPct, topVendors, topVendorPct, deductibleRatio, potentialDuplicates, detectedSubscriptions, subscriptionMonthlyTotal, savingsOpps, annualForecast, totalIncome, growingCategories, nonDeductibleTotal } = d

    if (burnRate > 70)
      recs.push({ icon: '🔥', msg: `Expenses consuming ${burnRate.toFixed(0)}% of revenue. Cut the 2 largest non-essential categories to below 60%.`, priority: 'high' })

    if (potentialDuplicates.length > 0)
      recs.push({ icon: '🔁', msg: `${potentialDuplicates.length} potential duplicate charge${potentialDuplicates.length > 1 ? 's' : ''} flagged. Scroll down to review and dispute.`, priority: 'high' })

    if (deductibleRatio < 0.4 && expenses.length > 3)
      recs.push({ icon: '🧾', msg: `Only ${(deductibleRatio * 100).toFixed(0)}% of expenses are marked deductible. Review your records — you may be leaving tax savings on the table.`, priority: 'high' })

    if (topVendorPct > 50 && topVendors[0])
      recs.push({ icon: '🏪', msg: `${topVendors[0].vendor} accounts for ${topVendorPct.toFixed(0)}% of total spend. Evaluate alternatives to reduce vendor concentration risk.`, priority: 'medium' })

    if (expGrowthPct > 20)
      recs.push({ icon: '📈', msg: `Expenses grew ${expGrowthPct.toFixed(0)}% vs last month. Review your largest categories to understand what's driving the increase.`, priority: 'high' })

    if (detectedSubscriptions.length >= 3)
      recs.push({ icon: '📱', msg: `${detectedSubscriptions.length} recurring services detected totaling ${fmt$(subscriptionMonthlyTotal)}/mo (${fmt$(subscriptionMonthlyTotal * 12, 0)}/yr). Audit for unused subscriptions.`, priority: 'medium' })

    if (annualForecast > totalIncome * 1.1 && totalIncome > 0)
      recs.push({ icon: '⚠️', msg: `At current pace, annual expenses (${fmt$(annualForecast, 0)}) may exceed total income (${fmt$(totalIncome, 0)}). Reduce burn rate now.`, priority: 'high' })

    if (growingCategories.length > 0)
      recs.push({ icon: '📊', msg: `${growingCategories[0].cat} expenses grew ${growingCategories[0].growth.toFixed(0)}% this month. Monitor for recurring increases.`, priority: 'medium' })

    if (savingsOpps.length > 0 && savingsOpps[0])
      recs.push({ icon: '💡', msg: `Identified ${fmt$(savingsOpps.reduce((s, o) => s + o.value, 0), 0)} in potential savings. See Cost Optimization section below.`, priority: 'low' })

    if (burnRate < 30 && expenses.length > 0)
      recs.push({ icon: '✅', msg: `Excellent burn rate at ${burnRate.toFixed(0)}%. Your cost structure is efficient. Reinvest savings into growth.`, priority: 'low' })

    return recs.slice(0, 6)
  }, [d, expenses])

  /* ── Trend chart data ── */
  const trendData = useMemo(() => {
    if (trendRange === '30d') return buildDailyExpenses(expenses, income, 30)
    if (trendRange === '90d') return buildMonthlyExpenses(expenses, income, 3)
    if (trendRange === '12m') return buildMonthlyExpenses(expenses, income, 12)
    const allDates = [...expenses.map(e => e.date), ...income.map(i => i.date)]
    if (!allDates.length) return []
    const earliest = new Date(Math.min(...allDates.map(s => new Date(s).getTime())))
    const now = new Date()
    const count = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1
    return buildMonthlyExpenses(expenses, income, Math.max(count, 1))
  }, [expenses, income, trendRange])

  /* ── Add expense ── */
  async function add(e: React.FormEvent) {
    e.preventDefault()
    const sb = createClient()
    const { error } = await sb.from('expenses').insert({
      user_id: userId, ...form,
      amount: parseFloat(form.amount),
      is_subscription: form.is_subscription,
      subscription_period: form.is_subscription ? form.subscription_period : null,
      notes: form.notes || null,
      receipt_ref: form.receipt_ref || null,
    })
    if (error) { toast.error('Failed to add expense'); return }
    toast.success('Expense added ✓')
    setShowForm(false)
    setForm({ ...DEFAULT_FORM })
    load()
  }

  async function remove(id: string) {
    const sb = createClient()
    await sb.from('expenses').delete().eq('id', id)
    toast.success('Removed')
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  /* ── CSV Export ── */
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

  function exportAll()       { exportCsv(expenses.map(e => ({ date: e.date, vendor: e.vendor, amount: e.amount, category: e.category, deductible: e.is_deductible, status: e.status, notes: e.notes || '' })), 'expenses_all.csv') }
  function exportMonth()     { const now = new Date(); exportCsv(expenses.filter(e => { const d = new Date(e.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() }).map(e => ({ date: e.date, vendor: e.vendor, amount: e.amount, category: e.category, deductible: e.is_deductible })), `expenses_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}.csv`) }
  function exportDeductible() { exportCsv(expenses.filter(e => e.is_deductible).map(e => ({ date: e.date, vendor: e.vendor, amount: e.amount, category: e.category })), 'expenses_deductible.csv') }
  function exportYearly()    { const yr = new Date().getFullYear(); exportCsv(expenses.filter(e => new Date(e.date).getFullYear() === yr).map(e => ({ date: e.date, vendor: e.vendor, amount: e.amount, category: e.category, deductible: e.is_deductible })), `expenses_${yr}.csv`) }

  /* ── Styles ── */
  const lStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block' }
  const iStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 44, width: 280, marginBottom: 28 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[...Array(6)].map((_, i) => <div key={i} style={{ height: 90 }} className="skeleton" />)}
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

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Expenses</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Profit protection & cost intelligence.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Expense</button>
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" onClick={() => setExportOpen(s => !s)}>⬇ Export</button>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    style={{ position: 'absolute', top: '110%', right: 0, width: 200, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', zIndex: 40, padding: 8 }}>
                    {[
                      { label: 'All Expenses (CSV)',        fn: exportAll },
                      { label: 'This Month (CSV)',          fn: exportMonth },
                      { label: 'Annual Report (CSV)',       fn: exportYearly },
                      { label: 'Deductible Only (CSV)',     fn: exportDeductible },
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

        {/* ══ SECTION 1 — 6 KPI Cards ══ */}
        <div className="stat-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Expenses',      value: d.totalExpenses,        prefix: '$', color: '#ff7043', icon: '🧮', sub: `${expenses.length} transactions` },
            { label: 'Current Month',       value: d.currentMonthExpenses,  prefix: '$', color: '#ef4444', icon: '📅',
              sub: expenses.length > 1 ? `${d.expGrowthPct >= 0 ? '▲' : '▼'} ${Math.abs(d.expGrowthPct).toFixed(0)}% vs last month` : undefined,
              subColor: d.expGrowthPct <= 0 ? '#10b981' : '#ef4444' },
            { label: 'Avg Monthly',         value: d.avgMonthlyExpenses,    prefix: '$', color: '#f59e0b', icon: '📊', sub: '3-month average' },
            { label: 'Burn Rate',           value: d.burnRate,               prefix: '', suffix: '%', decimals: 0, color: d.burnRate < 40 ? '#10b981' : d.burnRate < 70 ? '#f59e0b' : '#ef4444', icon: '🔥',
              sub: d.currentMonthIncome > 0 ? `vs ${fmt$(d.currentMonthIncome, 0)} income` : 'Add income to calculate' },
            { label: 'Tax Deductible',      value: d.deductibleTotal,        prefix: '$', color: '#10b981', icon: '✅',
              sub: `${(d.deductibleRatio * 100).toFixed(0)}% of total spend` },
            { label: 'Annual Forecast',     value: d.annualForecast,         prefix: '$', decimals: 0, color: '#8b5cf6', icon: '🔮',
              sub: 'at current run rate' },
          ].map((s, i) => (
            <motion.div key={s.label} className="stat-card"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
              </div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>
                {s.prefix}
                <CountUp end={s.value} decimals={('decimals' in s ? (s.decimals as number) : s.prefix === '$' ? 2 : 0)} duration={1.2} separator="," />
                {'suffix' in s && s.suffix}
              </div>
              {s.sub && (
                <div className="stat-sub" style={{ color: ('subColor' in s ? s.subColor as string : undefined), marginTop: 4 }}>
                  {s.sub}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* ══ SECTION 2+3 — Expense Health + Coach ══ */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Expense Health */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 340px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Spend Health</h2>
              <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Live signal based on your data</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14, background: d.hwBgs[d.hwStatus], border: `1.5px solid ${d.hwColors[d.hwStatus]}33`, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: d.hwColors[d.hwStatus], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {d.hwStatus === 'green' ? '✅' : d.hwStatus === 'yellow' ? '⚠️' : '🚨'}
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 13, color: d.hwColors[d.hwStatus], marginBottom: 2 }}>{d.hwTitle}</p>
                <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{d.hwDetail}</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.healthFactors.map(f => (
                <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--mu)' }}>{f.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.val}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Expense Coach */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 340px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Expense Coach</h2>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Data-driven cost insights</p>
              </div>
              <div className="live-dot" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {coachRecs.map((r, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', borderLeft: `3px solid ${r.priority === 'high' ? '#ef4444' : r.priority === 'medium' ? '#f59e0b' : '#10b981'}` }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                    <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{r.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ══ SECTION 4 — Expense Trend Chart ══ */}
        <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Spend vs Revenue Trend</h2>
              <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Expenses and income over time</p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['30d','90d','12m','all'] as const).map(v => (
                <button key={v} onClick={() => setTrendRange(v)}
                  style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, background: trendRange === v ? '#ff7043' : 'var(--bg3)', color: trendRange === v ? '#fff' : 'var(--mu)', transition: 'all 0.15s' }}>
                  {v === 'all' ? 'All' : v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {trendData.every(b => b.expenses === 0 && b.income === 0) ? (
            <MiniEmpty icon="📉" msg="Add expenses and income to see your spend trend" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ff7043" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ff7043" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="income"   name="Revenue"  stroke="#10b981" strokeWidth={2} fill="url(#gInc)" dot={false} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ff7043" strokeWidth={2.5} fill="url(#gExp)" dot={false} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* ══ SECTION 5 — Category + Vendor ══ */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Category Breakdown */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Spend by Category</h2>
              <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Where your money is going</p>
            </div>
            {d.topCategories.length === 0 ? (
              <MiniEmpty icon="📊" msg="Add expenses to see your category breakdown" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.topCategories.slice(0, 7).map((c, i) => (
                  <div key={c.cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {c.cat}
                        {d.growingCategories.find(g => g.cat === c.cat) && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 99 }}>
                            ▲ {d.growingCategories.find(g => g.cat === c.cat)!.growth.toFixed(0)}%
                          </span>
                        )}
                      </span>
                      <span style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, color: c.color }}>{fmt$(c.amt)}</span>
                    </div>
                    <div className="progress-track" style={{ height: 6 }}>
                      <motion.div className="progress-fill"
                        initial={{ width: 0 }} animate={{ width: `${c.pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.04 }}
                        style={{ background: c.color }} />
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>{c.pct.toFixed(0)}% of total spend</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Vendor Intelligence */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Vendor Intelligence</h2>
              <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Top vendors by total spend</p>
            </div>
            {d.topVendorPct > 55 && d.topVendors[0] && (
              <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 12, fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                ⚠️ {d.topVendors[0].vendor} = {d.topVendorPct.toFixed(0)}% of spend. High concentration.
              </div>
            )}
            {d.topVendors.length === 0 ? (
              <MiniEmpty icon="🏪" msg="Add expenses to see vendor analysis" />
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
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--mu)', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>{v.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ══ SECTION 6 — Subscriptions + Duplicates ══ */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Subscription Tracker */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Subscription Tracker</h2>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Recurring services detected from your data</p>
              </div>
              {d.subscriptionMonthlyTotal > 0 && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mu2)' }}>Monthly Total</p>
                  <p style={{ fontSize: 15, fontWeight: 900, color: '#ff7043', fontFamily: "DM Mono, monospace" }}>{fmt$(d.subscriptionMonthlyTotal)}</p>
                </div>
              )}
            </div>
            {d.detectedSubscriptions.length === 0 ? (
              <MiniEmpty icon="📱" msg="No recurring services detected yet. They appear automatically when a vendor charges you 2+ months in a row." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.detectedSubscriptions.map((s, i) => (
                  <div key={s.vendor} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{s.vendor}</p>
                      <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 1 }}>{s.category} · {s.months} months</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#ff7043', fontFamily: "DM Mono, monospace" }}>{fmt$(s.monthlyAvg)}/mo</p>
                      <p style={{ fontSize: 9, color: 'var(--mu2)', marginTop: 1 }}>{fmt$(s.monthlyAvg * 12, 0)}/yr</p>
                    </div>
                  </div>
                ))}
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,112,67,0.07)', border: '1px solid rgba(255,112,67,0.2)', fontSize: 11, color: 'var(--ink)', textAlign: 'center' }}>
                  💡 Audit these {d.detectedSubscriptions.length} services — cancel any you no longer actively use.
                </div>
              </div>
            )}
          </motion.div>

          {/* Duplicate Detection */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Duplicate Detection</h2>
              <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Same vendor · similar amount · within 7 days</p>
            </div>
            {d.potentialDuplicates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>✅</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>No duplicates detected</p>
                <p style={{ fontSize: 12, color: 'var(--mu)' }}>Your expense records look clean.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.potentialDuplicates.slice(0, 4).map((dup, i) => (
                  <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{dup.e1.vendor}</p>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Potential Dup</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                      <div style={{ flex: 1, padding: '6px 8px', background: 'var(--bg3)', borderRadius: 8 }}>
                        <p style={{ color: 'var(--mu)', marginBottom: 2 }}>{dup.e1.date}</p>
                        <p style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, color: 'var(--ink)' }}>{fmt$(Number(dup.e1.amount))}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', fontSize: 14 }}>↔</div>
                      <div style={{ flex: 1, padding: '6px 8px', background: 'var(--bg3)', borderRadius: 8 }}>
                        <p style={{ color: 'var(--mu)', marginBottom: 2 }}>{dup.e2.date}</p>
                        <p style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, color: 'var(--ink)' }}>{fmt$(Number(dup.e2.amount))}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--mu2)', marginTop: 6 }}>{dup.daysDiff === 0 ? 'Same day' : `${dup.daysDiff} day${dup.daysDiff > 1 ? 's' : ''} apart`}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ══ SECTION 7 — Tax Deduction Center ══ */}
        <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Tax Deduction Center</h2>
            <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Maximise your deductible expenses to reduce taxable income</p>
          </div>
          {expenses.length === 0 ? (
            <MiniEmpty icon="🧾" msg="Add expenses to start tracking deductions" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {/* Deductible summary */}
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: 'Deductible',      val: d.deductibleTotal,    color: '#10b981', pct: d.deductibleRatio * 100 },
                    { label: 'Non-Deductible',  val: d.nonDeductibleTotal, color: '#ff7043', pct: (1 - d.deductibleRatio) * 100 },
                  ].map(t => (
                    <div key={t.label} style={{ padding: '14px', borderRadius: 12, background: 'var(--bg3)' }}>
                      <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 4 }}>{t.label}</p>
                      <p style={{ fontSize: 18, fontWeight: 900, color: t.color, fontFamily: "DM Mono, monospace" }}>{fmt$(t.val)}</p>
                      <p style={{ fontSize: 10, color: 'var(--mu2)', marginTop: 3 }}>{t.pct.toFixed(0)}% of total</p>
                    </div>
                  ))}
                </div>
                <div className="progress-track" style={{ height: 8, marginBottom: 8, borderRadius: 99, overflow: 'hidden' }}>
                  <motion.div style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #6366f1)', borderRadius: 99 }}
                    initial={{ width: 0 }} animate={{ width: `${d.deductibleRatio * 100}%` }} transition={{ duration: 0.9 }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 14 }}>{fmt$(d.deductibleTotal)} tax-deductible · saves ~{fmt$(d.deductibleTotal * 0.25, 0)} in taxes</p>
              </div>

              {/* By category */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu2)', marginBottom: 10 }}>Deductible by Category</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(d.catDeductible)
                    .filter(([_, v]) => v.ded > 0 || v.nonDed > 0)
                    .sort((a, b) => (b[1].ded + b[1].nonDed) - (a[1].ded + a[1].nonDed))
                    .slice(0, 6)
                    .map(([cat, v]) => {
                      const total = v.ded + v.nonDed
                      const pct = total > 0 ? v.ded / total * 100 : 0
                      return (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--mu)', minWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                          <div className="progress-track" style={{ flex: 1, height: 5 }}>
                            <div className="progress-fill" style={{ width: `${pct}%`, background: pct > 70 ? '#10b981' : pct > 30 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--mu2)', minWidth: 32, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Missing deductions alert */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu2)', marginBottom: 10 }}>Possible Missing Deductions</p>
                {(() => {
                  const alerts = Object.entries(d.catDeductible)
                    .filter(([cat, v]) => v.nonDed > 100 && ['Software','Marketing','Equipment','Professional Services','Operations','Office','Travel'].includes(cat))
                  return alerts.length === 0 ? (
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                      ✅ No obvious missing deductions found.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {alerts.slice(0, 3).map(([cat, v]) => (
                        <div key={cat} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>{cat}</p>
                          <p style={{ fontSize: 11, color: 'var(--ink)' }}>{fmt$(v.nonDed)} not marked deductible. Business {cat.toLowerCase()} is typically deductible.</p>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </motion.div>

        {/* ══ SECTION 8 — Cost Optimization + Annual Forecast ══ */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Savings Opportunities */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Cost Optimization</h2>
              <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Savings opportunities from your data</p>
            </div>
            {d.savingsOpps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>🏆</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Spend looks optimised</p>
                <p style={{ fontSize: 12, color: 'var(--mu)' }}>No immediate savings opportunities detected.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.savingsOpps.map((o, i) => (
                  <div key={i} style={{ padding: '14px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--bd)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{o.icon}</span>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{o.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>{o.detail}</p>
                        <p style={{ fontSize: 12, fontWeight: 800, color: '#10b981', marginTop: 6 }}>Potential saving: {fmt$(o.value)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 11, color: 'var(--ink)', textAlign: 'center' }}>
                  <strong style={{ color: '#6366f1' }}>Total opportunity: {fmt$(d.savingsOpps.reduce((s, o) => s + o.value, 0))}</strong>
                </div>
              </div>
            )}
          </motion.div>

          {/* Annual Forecast */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Annual Forecast</h2>
              <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Projected spend based on current run rate</p>
            </div>
            {expenses.length === 0 ? (
              <MiniEmpty icon="🔮" msg="Add expenses to see your annual forecast" />
            ) : (
              <>
                <div style={{ padding: '20px', borderRadius: 14, background: 'var(--bg3)', marginBottom: 14, textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 6 }}>Forecasted Annual Spend</p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: '#ff7043', fontFamily: "DM Mono, monospace", letterSpacing: '-0.03em' }}>{fmt$(d.annualForecast, 0)}</p>
                  {d.totalIncome > 0 && (
                    <p style={{ fontSize: 11, color: d.annualForecast < d.totalIncome ? '#10b981' : '#ef4444', marginTop: 6, fontWeight: 700 }}>
                      {d.annualForecast < d.totalIncome ? `✅ ${fmt$(d.totalIncome - d.annualForecast, 0)} below income` : `⚠️ ${fmt$(d.annualForecast - d.totalIncome, 0)} above income`}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'This month spend',    val: d.currentMonthExpenses },
                    { label: 'Avg monthly (3-mo)',  val: d.avgMonthlyExpenses },
                    { label: 'Year-to-date spend',  val: d.yearExpenses },
                    { label: 'Annual forecast',     val: d.annualForecast },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--mu)' }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', fontFamily: "DM Mono, monospace" }}>{fmt$(r.val)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* ══ SECTION 9 — Download Center ══ */}
        <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Download Center</h2>
            <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Export your expense data</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[
              { label: 'All Expenses',       icon: '🧮', desc: 'Complete history', fn: exportAll },
              { label: 'This Month',         icon: '📅', desc: 'Current month',    fn: exportMonth },
              { label: 'Annual Report',      icon: '📆', desc: `${new Date().getFullYear()} expenses`,  fn: exportYearly },
              { label: 'Deductible Only',    icon: '✅', desc: 'Tax deductions',   fn: exportDeductible },
              { label: 'Receipt Vault',      icon: '📁', desc: 'Document storage', fn: () => router.push('/vault') },
            ].map(x => (
              <button key={x.label} onClick={x.fn}
                style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--bd)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = '1px solid #ff7043' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = '1px solid var(--bd)' }}>
                <span style={{ fontSize: 20, display: 'block', marginBottom: 6 }}>{x.icon}</span>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{x.label}</p>
                <p style={{ fontSize: 10, color: 'var(--mu)' }}>{x.desc}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ══ EXISTING EXPENSE TABLE (preserved) ══ */}
        <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800 }}>All Expenses</h2>
            <span style={{ fontSize: 11, color: 'var(--mu)' }}>{expenses.length} records · {fmt$(d.totalExpenses)} total</span>
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.form
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                onSubmit={add} style={{ padding: '20px 24px', borderBottom: '1px solid var(--bd)', background: 'rgba(255,112,67,0.04)', overflow: 'hidden' }}>
                <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={lStyle}>Vendor</label>
                    <input className="input" style={{ marginTop: 6 }} required value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Adobe, AWS, etc." />
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
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4, gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                      <input type="checkbox" checked={form.is_deductible} onChange={e => setForm(f => ({ ...f, is_deductible: e.target.checked }))} />
                      Tax deductible
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                      <input type="checkbox" checked={form.is_subscription} onChange={e => setForm(f => ({ ...f, is_subscription: e.target.checked }))} />
                      Subscription
                    </label>
                  </div>
                  {form.is_subscription && (
                    <div>
                      <label style={lStyle}>Recurrence</label>
                      <select className="input" style={{ marginTop: 6 }} value={form.subscription_period} onChange={e => setForm(f => ({ ...f, subscription_period: e.target.value }))}>
                        {RECURRENCE.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={lStyle}>Receipt Ref. (optional)</label>
                    <input className="input" style={{ marginTop: 6 }} value={form.receipt_ref} onChange={e => setForm(f => ({ ...f, receipt_ref: e.target.value }))} placeholder="REC-001 or filename" />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lStyle}>Notes (optional)</label>
                  <input className="input" style={{ marginTop: 6 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Business purpose, project, etc." />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn-primary">Save expense</button>
                  <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setForm({ ...DEFAULT_FORM }) }}>Cancel</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {expenses.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🧮</span>
              <h3>No expenses yet — enjoy it while it lasts 😄</h3>
              <p>Add your business expenses to track spending and maximise tax deductions.</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>Add expense →</button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="mobile-table-hide">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24 }}>Vendor</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th>Deductible</th>
                      <th>Ref</th>
                      <th style={{ textAlign: 'right', paddingRight: 24 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(item => (
                      <tr key={item.id} className="group">
                        <td style={{ paddingLeft: 24 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,112,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                              {item.is_subscription ? '🔄' : '🧮'}
                            </div>
                            <div>
                              <span style={{ fontWeight: 500 }}>{item.vendor}</span>
                              {item.notes && <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 1 }}>{item.notes}</p>}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--mu)', fontSize: 12 }}>{item.category}</td>
                        <td style={{ color: 'var(--mu)', fontSize: 12 }}>{new Date(item.date).toLocaleDateString()}</td>
                        <td><span style={{ fontSize: 11, color: item.is_deductible ? '#10b981' : 'var(--mu)' }}>{item.is_deductible ? '✓ Yes' : 'No'}</span></td>
                        <td style={{ color: 'var(--mu2)', fontSize: 11 }}>{item.receipt_ref || '—'}</td>
                        <td style={{ textAlign: 'right', paddingRight: 24 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                            <span style={{ fontFamily: "DM Mono, monospace", fontWeight: 600, color: '#ff7043' }}>-{fmt$(Number(item.amount))}</span>
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
                {expenses.map(item => (
                  <div key={item.id} className="mobile-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{item.vendor}</p>
                        <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>{item.category}{item.is_subscription ? ' · 🔄 Sub' : ''}</p>
                      </div>
                      <p style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, color: '#ff7043', fontSize: 15 }}>-{fmt$(Number(item.amount))}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: item.is_deductible ? '#10b981' : 'var(--mu)', fontWeight: 600 }}>
                          {item.is_deductible ? '✓ Deductible' : 'Non-deductible'}
                        </span>
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
      <style>{`.group:hover .del-btn, tr:hover .del-btn { opacity: 1 !important; }`}</style>
    </div>
  )
}
