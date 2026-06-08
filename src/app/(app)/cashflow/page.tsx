'use client'
/*
 * BUSINESS FORECAST CENTER — Cash Flow Command Center
 * All analytics from real Supabase data. No mock data.
 * Font names with spaces: template literals or double-quoted strings only.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
} from 'recharts'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import CountUp from 'react-countup'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type IncomeRow  = { id: string; date: string; amount: number; client_name?: string; status: string }
type ExpenseRow = { id: string; date: string; amount: number; category: string; vendor: string; is_subscription?: boolean }
type InvoiceRow = { id: string; invoice_number: string; status: string; total?: number; balance_due?: number; client_name: string; due_date?: string; created_at: string }
type Scenario   = 'expected' | 'best' | 'worst'
type Range      = '6m' | '12m' | 'all'

/* ─── Utilities ──────────────────────────────────────────────────────────── */
function fmt$(n: number, dec = 2) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}

function monthLabel(d: Date) {
  return d.toLocaleString('default', { month: 'short', year: '2-digit' })
}

/* ─── InfoIcon ───────────────────────────────────────────────────────────── */
function InfoIcon({ tip }: { tip: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
      <button type="button"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)}
        style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--bd2)', color: 'var(--mu)', fontSize: 9, cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>
        i
      </button>
      {show && (
        <span role="tooltip" style={{ position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: 'var(--ink)', lineHeight: 1.6, width: 200, zIndex: 99, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', pointerEvents: 'none', whiteSpace: 'normal', fontWeight: 400 }}>
          {tip}
        </span>
      )}
    </span>
  )
}

/* ─── Chart tooltip ──────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 11, minWidth: 150 }}>
      <p style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>{p.name}: <strong>{fmt$(p.value)}</strong></p>)}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function CashflowPage() {
  const router = useRouter()

  /* ── Data ── */
  const [incomeData, setIncomeData]   = useState<IncomeRow[]>([])
  const [expenseData, setExpenseData] = useState<ExpenseRow[]>([])
  const [invoiceData, setInvoiceData] = useState<InvoiceRow[]>([])
  const [loading, setLoading]         = useState(true)

  /* ── UI ── */
  const [range, setRange]           = useState<Range>('12m')
  const [scenario, setScenario]     = useState<Scenario>('expected')
  const [exportOpen, setExportOpen] = useState(false)

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const [incRes, expRes, invRes] = await Promise.all([
      sb.from('income').select('id,date,amount,client_name,status').eq('user_id', user.id),
      sb.from('expenses').select('id,date,amount,category,vendor,is_subscription').eq('user_id', user.id),
      sb.from('invoices').select('id,invoice_number,status,total,balance_due,client_name,due_date,created_at').eq('user_id', user.id),
    ])
    setIncomeData(incRes.data ?? [])
    setExpenseData(expRes.data ?? [])
    setInvoiceData(invRes.data ?? [])
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
    const sixAgo       = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    const daysElapsed  = now.getDate()
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    /* ── Totals ── */
    const totalIncome   = incomeData.reduce((s, i) => s + Number(i.amount), 0)
    const totalExpenses = expenseData.reduce((s, e) => s + Number(e.amount), 0)
    const netCash       = totalIncome - totalExpenses

    /* ── Current month ── */
    const thisMonthIncome   = incomeData.filter(i => new Date(i.date) >= monthStart).reduce((s, i) => s + Number(i.amount), 0)
    const thisMonthExpenses = expenseData.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + Number(e.amount), 0)
    const thisMonthNet      = thisMonthIncome - thisMonthExpenses

    /* ── Previous month ── */
    const prevMonthIncome   = incomeData.filter(i => { const d = new Date(i.date); return d >= prevStart && d <= prevEnd }).reduce((s, i) => s + Number(i.amount), 0)
    const prevMonthExpenses = expenseData.filter(e => { const d = new Date(e.date); return d >= prevStart && d <= prevEnd }).reduce((s, e) => s + Number(e.amount), 0)

    /* ── Averages (last 3 months) ── */
    const incLast3  = incomeData.filter(i => new Date(i.date) >= threeAgo).reduce((s, i) => s + Number(i.amount), 0)
    const expLast3  = expenseData.filter(e => new Date(e.date) >= threeAgo).reduce((s, e) => s + Number(e.amount), 0)
    const avgMonthlyIncome   = incLast3 / 3
    const avgMonthlyExpenses = expLast3 > 0 ? expLast3 / 3 : totalExpenses > 0 ? totalExpenses / Math.max(1, new Set(expenseData.map(e => e.date.substring(0, 7))).size) : 0

    /* ── Trend (income direction) ── */
    const incomeGrowthPct = prevMonthIncome > 0 ? ((thisMonthIncome - prevMonthIncome) / prevMonthIncome) * 100 : thisMonthIncome > 0 ? 100 : 0
    const expGrowthPct    = prevMonthExpenses > 0 ? ((thisMonthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100 : thisMonthExpenses > 0 ? 100 : 0
    const trendFactor     = Math.max(-0.3, Math.min(0.3, incomeGrowthPct / 100))

    /* ── Subscriptions / recurring outflows ── */
    const vendorMonths: Record<string, { months: Set<string>; amounts: number[] }> = {}
    expenseData.forEach(e => {
      const key = e.vendor.toLowerCase().trim()
      if (!vendorMonths[key]) vendorMonths[key] = { months: new Set(), amounts: [] }
      vendorMonths[key].months.add(e.date.substring(0, 7))
      vendorMonths[key].amounts.push(Number(e.amount))
    })
    const recurringExpenses = Object.entries(vendorMonths)
      .filter(([_, v]) => v.months.size >= 2)
      .map(([_, v]) => { const avg = v.amounts.reduce((s, a) => s + a, 0) / v.amounts.length; const cv = avg > 0 ? Math.sqrt(v.amounts.map(a => (a - avg) ** 2).reduce((s, x) => s + x, 0) / v.amounts.length) / avg : 1; return { avg, cv } })
      .filter(s => s.cv < 0.25)
    const monthlyRecurring = recurringExpenses.reduce((s, x) => s + x.avg, 0)

    /* ── Invoices / receivables ── */
    const unpaidInvoices   = invoiceData.filter(i => ['sent','overdue','viewed','partial'].includes(i.status))
    const overdueInvoices  = invoiceData.filter(i => i.status === 'overdue')
    const totalOutstanding = unpaidInvoices.reduce((s, i) => s + Math.max(0, Number(i.balance_due ?? i.total ?? 0)), 0)
    const overdueAmount    = overdueInvoices.reduce((s, i) => s + Math.max(0, Number(i.balance_due ?? i.total ?? 0)), 0)

    /* ── Cash runway ── */
    const cashRunwayMonths = avgMonthlyExpenses > 0 ? Math.max(0, netCash / avgMonthlyExpenses) : 0

    /* ── Projected end of month ── */
    const dailyIncRate    = daysElapsed > 0 ? thisMonthIncome / daysElapsed : 0
    const dailyExpRate    = daysElapsed > 0 ? thisMonthExpenses / daysElapsed : 0
    const projMonthEndInc = dailyIncRate * daysInMonth
    const projMonthEndExp = dailyExpRate * daysInMonth
    const projMonthEndNet = projMonthEndInc - projMonthEndExp

    /* ── 30/60/90 day forecast ── */
    const mInc = avgMonthlyIncome > 0 ? avgMonthlyIncome : thisMonthIncome
    const mExp = avgMonthlyExpenses > 0 ? avgMonthlyExpenses : thisMonthExpenses
    const scenarioMults = { expected: { inc: 1 + trendFactor, exp: 1 }, best: { inc: 1.2 + trendFactor, exp: 0.9 }, worst: { inc: 0.8 + trendFactor, exp: 1.15 } }
    const sm = scenarioMults[scenario]
    const forecast = [
      { period: '30d', label: 'Next 30 Days',  income: mInc * sm.inc,       expenses: mExp * sm.exp,       net: mInc * sm.inc - mExp * sm.exp },
      { period: '60d', label: 'Next 60 Days',  income: mInc * sm.inc * 2,   expenses: mExp * sm.exp * 2,   net: (mInc * sm.inc - mExp * sm.exp) * 2 },
      { period: '90d', label: 'Next 90 Days',  income: mInc * sm.inc * 3,   expenses: mExp * sm.exp * 3,   net: (mInc * sm.inc - mExp * sm.exp) * 3 },
    ]

    /* ── Cash Health Score ── */
    let healthScore = 55
    if (netCash > 0)           healthScore += 12
    if (incomeGrowthPct > 10)  healthScore += 10
    else if (incomeGrowthPct < -15) healthScore -= 15
    else if (incomeGrowthPct < -5)  healthScore -= 8
    if (cashRunwayMonths > 6)  healthScore += 12
    else if (cashRunwayMonths > 3) healthScore += 6
    else if (cashRunwayMonths < 1 && incomeData.length > 0) healthScore -= 18
    if (avgMonthlyExpenses > 0 && avgMonthlyIncome / avgMonthlyExpenses > 1.5) healthScore += 8
    else if (avgMonthlyIncome < avgMonthlyExpenses && incomeData.length > 2)  healthScore -= 12
    if (overdueAmount > totalOutstanding * 0.4 && overdueAmount > 0) healthScore -= 8
    if (expGrowthPct > 20) healthScore -= 8
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))
    const healthLabel = healthScore >= 75 ? 'Excellent' : healthScore >= 55 ? 'Healthy' : healthScore >= 35 ? 'Monitor' : 'Action Needed'
    const healthColor = healthScore >= 75 ? '#10b981' : healthScore >= 55 ? '#0ea5e9' : healthScore >= 35 ? '#f59e0b' : '#ef4444'

    /* ── Risks ── */
    const risks: { icon: string; title: string; detail: string; severity: 'high'|'medium'|'low' }[] = []
    if (overdueAmount > 0)
      risks.push({ icon: '🚨', title: 'Overdue Invoices', detail: `${fmt$(overdueAmount)} past due across ${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's' : ''}.`, severity: 'high' })
    if (incomeGrowthPct < -15 && incomeData.length > 3)
      risks.push({ icon: '📉', title: 'Revenue Declining', detail: `Revenue down ${Math.abs(incomeGrowthPct).toFixed(0)}% vs last month.`, severity: 'high' })
    if (expGrowthPct > 25)
      risks.push({ icon: '📈', title: 'Expenses Accelerating', detail: `Expenses grew ${expGrowthPct.toFixed(0)}% vs last month.`, severity: 'medium' })
    if (cashRunwayMonths > 0 && cashRunwayMonths < 2 && incomeData.length > 0)
      risks.push({ icon: '⏰', title: 'Low Cash Runway', detail: `Only ${cashRunwayMonths.toFixed(1)} months of runway remaining at current burn.`, severity: 'high' })
    if (projMonthEndNet < 0 && daysElapsed > 5)
      risks.push({ icon: '⚠️', title: 'Negative Cash Flow Forecast', detail: `On current pace, this month ends ${fmt$(Math.abs(projMonthEndNet))} in the negative.`, severity: 'medium' })

    /* ── Opportunities ── */
    const opps: { icon: string; title: string; detail: string; value: number }[] = []
    if (totalOutstanding > 0)
      opps.push({ icon: '💸', title: 'Collect Outstanding Invoices', detail: `${fmt$(totalOutstanding)} across ${unpaidInvoices.length} invoice${unpaidInvoices.length > 1 ? 's' : ''} ready to follow up.`, value: totalOutstanding })
    if (monthlyRecurring > 0)
      opps.push({ icon: '📱', title: 'Review Subscriptions', detail: `${fmt$(monthlyRecurring)}/mo in recurring expenses. Audit for unused services.`, value: monthlyRecurring * 0.15 * 12 })
    if (projMonthEndNet > 0)
      opps.push({ icon: '💡', title: 'Month-End Surplus', detail: `Projected ${fmt$(projMonthEndNet)} surplus by month end — consider reinvesting.`, value: projMonthEndNet })

    return {
      totalIncome, totalExpenses, netCash,
      thisMonthIncome, thisMonthExpenses, thisMonthNet,
      prevMonthIncome, prevMonthExpenses, incomeGrowthPct, expGrowthPct,
      avgMonthlyIncome, avgMonthlyExpenses, monthlyRecurring,
      totalOutstanding, overdueAmount, unpaidInvoices,
      cashRunwayMonths, projMonthEndInc, projMonthEndExp, projMonthEndNet,
      forecast, healthScore, healthLabel, healthColor,
      risks, opps, daysElapsed, daysInMonth,
    }
  }, [incomeData, expenseData, invoiceData, scenario])

  /* ── Chart data (range-filtered) ── */
  const chartData = useMemo(() => {
    const now = new Date()
    let months: number
    if (range === '6m') months = 6
    else if (range === '12m') months = 12
    else {
      const dates = [...incomeData.map(i => i.date), ...expenseData.map(e => e.date)]
      if (!dates.length) return []
      const earliest = new Date(Math.min(...dates.map(s => new Date(s).getTime())))
      months = Math.max(1, (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1)
    }
    return Array.from({ length: months }, (_, i) => {
      const mo  = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
      const end = new Date(mo.getFullYear(), mo.getMonth() + 1, 0, 23, 59, 59)
      const inc = incomeData.filter(x => { const d = new Date(x.date); return d >= mo && d <= end }).reduce((s, x) => s + Number(x.amount), 0)
      const exp = expenseData.filter(x => { const d = new Date(x.date); return d >= mo && d <= end }).reduce((s, x) => s + Number(x.amount), 0)
      return { label: monthLabel(mo), income: inc, expenses: exp, net: inc - exp }
    })
  }, [incomeData, expenseData, range])

  /* ── Running balance chart ── */
  const runningBalance = useMemo(() => {
    let balance = 0
    return chartData.map(row => { balance += row.net; return { label: row.label, balance } })
  }, [chartData])

  /* ── Monthly breakdown table ── */
  const monthlyTable = useMemo(() => [...chartData].reverse().slice(0, 12), [chartData])

  /* ── Export ── */
  function exportCsv(rows: Record<string, unknown>[], filename: string) {
    if (!rows.length) { toast.error('No data to export'); return }
    const h = Object.keys(rows[0])
    const csv = [h.join(','), ...rows.map(r => h.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = filename; a.click()
    toast.success(`${filename} exported ✓`); setExportOpen(false)
  }
  const exportMonthly   = () => exportCsv(chartData.map(r => ({ month: r.label, income: r.income.toFixed(2), expenses: r.expenses.toFixed(2), net: r.net.toFixed(2) })), 'cashflow_monthly.csv')
  const exportForecast  = () => exportCsv(d.forecast.map(f => ({ period: f.period, scenario, income: f.income.toFixed(2), expenses: f.expenses.toFixed(2), net: f.net.toFixed(2) })), `cashflow_forecast_${scenario}.csv`)
  const exportBalance   = () => exportCsv(runningBalance.map(r => ({ month: r.label, balance: r.balance.toFixed(2) })), 'cashflow_balance.csv')

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 44, width: 280, marginBottom: 28 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          {[...Array(7)].map((_, i) => <div key={i} style={{ height: 100 }} className="skeleton" />)}
        </div>
        <div style={{ height: 300, marginBottom: 20 }} className="skeleton" />
        <div style={{ height: 200 }} className="skeleton" />
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
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Understand your money movement, forecast your future, and protect your runway.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Range selector */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', borderRadius: 10, padding: 4 }}>
              {(['6m','12m','all'] as Range[]).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  style={{ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: range === r ? '#6366f1' : 'transparent', color: range === r ? '#fff' : 'var(--mu)', transition: 'all 0.15s', minHeight: 32 }}>
                  {r === 'all' ? 'All' : r.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" style={{ minHeight: 44 }} onClick={() => setExportOpen(s => !s)}>⬇ Export</button>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ position: 'absolute', top: '110%', right: 0, width: 210, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', zIndex: 40, padding: 8 }}>
                    {[
                      { label: 'Monthly Cash Flow (CSV)',   fn: exportMonthly },
                      { label: 'Running Balance (CSV)',     fn: exportBalance },
                      { label: 'Forecast CSV',              fn: exportForecast },
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
        {!hasData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ width: 88, height: 88, borderRadius: 28, background: 'linear-gradient(135deg,rgba(99,102,241,0.14),rgba(16,185,129,0.18))', border: '1.5px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, margin: '0 auto 24px', animation: 'float 3s ease-in-out infinite' }}>
              📈
            </div>
            <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.035em', marginBottom: 10 }}>No cash flow data yet.</h2>
            <p style={{ fontSize: 14, color: 'var(--mu)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 28px' }}>
              Add income and expenses to unlock cash flow analysis, forecasting, runway calculations, and trend charts.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-primary" style={{ padding: '13px 24px' }} onClick={() => router.push('/income')}>Add Income →</button>
              <button className="btn-ghost" onClick={() => router.push('/expenses')}>Add Expenses →</button>
            </div>
          </motion.div>
        )}

        {hasData && (
          <>
            {/* ══ 7 KPI CARDS ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Net Cash Position', value: d.netCash, prefix: '$', color: d.netCash >= 0 ? '#10b981' : '#ef4444', icon: '🏦', sub: d.netCash >= 0 ? 'Positive' : 'Negative', subColor: d.netCash >= 0 ? '#10b981' : '#ef4444', tip: 'Total income minus total expenses ever recorded. Your overall business cash position.' },
                { label: 'This Month Net', value: d.thisMonthNet, prefix: '$', color: d.thisMonthNet >= 0 ? '#10b981' : '#ef4444', icon: '📅',
                  sub: incomeData.length > 1 ? `${d.incomeGrowthPct >= 0 ? '▲' : '▼'} ${Math.abs(d.incomeGrowthPct).toFixed(0)}% income vs last mo` : undefined,
                  subColor: d.incomeGrowthPct >= 0 ? '#10b981' : '#ef4444', tip: 'This month income minus expenses so far.' },
                { label: 'Outstanding', value: d.totalOutstanding, prefix: '$', color: d.totalOutstanding > 0 ? '#f59e0b' : '#10b981', icon: '⏳',
                  sub: `${d.unpaidInvoices.length} unpaid invoice${d.unpaidInvoices.length !== 1 ? 's' : ''}`, tip: 'Money owed to you from unpaid invoices — collectible cash.' },
                { label: 'Cash Runway', value: d.cashRunwayMonths, prefix: '', suffix: ' mo', decimals: 1, color: d.cashRunwayMonths > 3 ? '#10b981' : d.cashRunwayMonths > 1 ? '#f59e0b' : '#ef4444', icon: '🛣️',
                  sub: `${fmt$(d.avgMonthlyExpenses, 0)}/mo burn`, tip: "At current burn rate, how many months until cash runs out." },
                { label: 'Avg Monthly In', value: d.avgMonthlyIncome, prefix: '$', decimals: 0, color: '#10b981', icon: '💰',
                  sub: '3-month average', tip: 'Average monthly income over the last 3 months. Used for forecasting.' },
                { label: 'Avg Monthly Out', value: d.avgMonthlyExpenses, prefix: '$', decimals: 0, color: '#ff7043', icon: '🧮',
                  sub: '3-month average', tip: 'Average monthly expenses over the last 3 months. Used for runway calculation.' },
                { label: 'Cash Health', value: d.healthScore, prefix: '', suffix: '/100', decimals: 0, color: d.healthColor, icon: '❤️',
                  sub: d.healthLabel, subColor: d.healthColor, tip: '0–100 composite score: net position, revenue trend, runway, expense ratio, collections.' },
              ].map((s, i) => (
                <motion.div key={s.label} className="stat-card"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <InfoIcon tip={s.tip} />
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

            {/* ══ MAIN CASH FLOW CHART ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Income vs Expenses</h2>
                  <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Monthly cash in and out</p>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--mu)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981', display: 'inline-block' }} />Income</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#ff7043', display: 'inline-block' }} />Expenses</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 3, background: '#6366f1', display: 'inline-block' }} />Net</span>
                </div>
              </div>
              {chartData.every(r => r.income === 0 && r.expenses === 0) ? (
                <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--mu)' }}>
                  <span style={{ fontSize: 32, marginBottom: 10 }}>📊</span>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>No data for this period</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="cfInc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                      <linearGradient id="cfExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff7043" stopOpacity={0.18} /><stop offset="95%" stopColor="#ff7043" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="income"   name="Income"   stroke="#10b981" strokeWidth={2.5} fill="url(#cfInc)" dot={false} activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ff7043" strokeWidth={2} fill="url(#cfExp)" dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="net" name="Net" stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* ══ RUNNING BALANCE + MONTHLY NET (2-col) ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Running Balance */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 4 }}>Cumulative Balance</h2>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 16 }}>Running net cash position over time</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={runningBalance}>
                    <defs>
                      <linearGradient id="cfBal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--mu)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--mu)' }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={(v) => [fmt$(Number(v)), 'Balance']} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="var(--bd2)" strokeDasharray="4 2" />
                    <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2.5} fill="url(#cfBal)" dot={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Monthly Net bars */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 260px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 4 }}>Monthly Net</h2>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 16 }}>Green = positive · red = negative month</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--mu)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--mu)' }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={(v) => [fmt$(Number(v)), 'Net']} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="var(--bd2)" />
                    <Bar dataKey="net" radius={[5, 5, 0, 0]} animationBegin={200} animationDuration={700}>
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.net >= 0 ? '#10b981' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* ══ FORECAST ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Cash Flow Forecast</h2>
                  <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>
                    Based on your {fmt$(d.avgMonthlyIncome, 0)}/mo income avg and {fmt$(d.avgMonthlyExpenses, 0)}/mo expense avg
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['expected','best','worst'] as Scenario[]).map(s => (
                    <button key={s} onClick={() => setScenario(s)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s', minHeight: 36,
                        background: scenario === s ? (s === 'best' ? '#10b981' : s === 'worst' ? '#ef4444' : '#6366f1') : 'var(--bg3)',
                        color: scenario === s ? '#fff' : 'var(--mu)' }}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={scenario} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                    {d.forecast.map(f => (
                      <div key={f.period} style={{ padding: '18px', borderRadius: 14, background: 'var(--bg3)', border: `1px solid ${f.net >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                        <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)', marginBottom: 6 }}>{f.label}</p>
                        <p style={{ fontSize: 24, fontWeight: 900, color: f.net >= 0 ? '#10b981' : '#ef4444', fontFamily: "DM Mono, monospace", letterSpacing: '-0.03em', marginBottom: 12 }}>
                          {f.net >= 0 ? '+' : ''}{fmt$(f.net, 0)}
                        </p>
                        {[
                          { label: 'Expected In',  val: f.income,   color: '#10b981' },
                          { label: 'Expected Out', val: f.expenses, color: '#ff7043' },
                        ].map(r => (
                          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 11, color: 'var(--mu)' }}>{r.label}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: r.color, fontFamily: "DM Mono, monospace" }}>{fmt$(r.val, 0)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--bd)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Scenario', val: scenario === 'best' ? '+20% income, −10% expenses' : scenario === 'worst' ? '−20% income, +15% expenses' : 'Current trend extrapolated' },
                      { label: 'Recurring fixed costs', val: fmt$(d.monthlyRecurring, 0) + '/mo' },
                      { label: 'Income trend', val: `${d.incomeGrowthPct >= 0 ? '+' : ''}${d.incomeGrowthPct.toFixed(0)}% MoM` },
                    ].map(r => (
                      <div key={r.label}>
                        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu2)', marginBottom: 2 }}>{r.label}</p>
                        <p style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{r.val}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* ══ RISKS + OPPORTUNITIES ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Upcoming Risks */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Upcoming Risks</h2>
                  {d.risks.filter(r => r.severity === 'high').length > 0 && (
                    <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 10, fontWeight: 800 }}>
                      {d.risks.filter(r => r.severity === 'high').length} High
                    </span>
                  )}
                </div>
                {d.risks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>✅</span>
                    <p style={{ fontSize: 12 }}>No significant cash flow risks detected.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {d.risks.map((r, i) => {
                      const c = r.severity === 'high' ? '#ef4444' : r.severity === 'medium' ? '#f59e0b' : '#0ea5e9'
                      return (
                        <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', borderLeft: `3px solid ${c}` }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontSize: 15, flexShrink: 0 }}>{r.icon}</span>
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{r.title}</p>
                              <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>{r.detail}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>

              {/* Upcoming Opportunities */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.49 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 14 }}>Opportunities</h2>
                {d.opps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>💡</span>
                    <p style={{ fontSize: 12 }}>Add more data to surface cash flow opportunities.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.opps.map((o, i) => (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--bd)' }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{o.icon}</span>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{o.title}</p>
                            <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>{o.detail}</p>
                          </div>
                        </div>
                        {o.value > 0 && <p style={{ fontSize: 12, fontWeight: 800, color: '#10b981', paddingLeft: 28 }}>{fmt$(o.value)} opportunity</p>}
                      </div>
                    ))}
                    {d.totalOutstanding > 0 && (
                      <button className="btn-primary" style={{ justifyContent: 'center', marginTop: 4 }} onClick={() => router.push('/invoices')}>
                        View Outstanding Invoices →
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ══ RUNWAY ANALYSIS ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Runway Analysis</h2>
                <InfoIcon tip="How long your business can continue operating at the current burn rate before running out of money." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
                {[
                  { label: 'Current Runway', value: `${d.cashRunwayMonths.toFixed(1)} months`, note: 'at current burn', color: d.cashRunwayMonths > 3 ? '#10b981' : d.cashRunwayMonths > 1 ? '#f59e0b' : '#ef4444' },
                  { label: 'Net Cash', value: fmt$(d.netCash, 0), note: 'total income minus expenses', color: d.netCash >= 0 ? '#10b981' : '#ef4444' },
                  { label: 'Monthly Burn', value: fmt$(d.avgMonthlyExpenses, 0), note: '3-month average', color: '#ff7043' },
                  { label: 'To 3-Month Safety', value: d.cashRunwayMonths >= 3 ? '✅ Met' : fmt$(Math.max(0, d.avgMonthlyExpenses * 3 - d.netCash), 0) + ' needed', note: '3× monthly expenses', color: d.cashRunwayMonths >= 3 ? '#10b981' : '#f59e0b' },
                ].map(r => (
                  <div key={r.label} style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--bd)' }}>
                    <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu2)', marginBottom: 6 }}>{r.label}</p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: r.color, fontFamily: "DM Mono, monospace" }}>{r.value}</p>
                    <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>{r.note}</p>
                  </div>
                ))}
              </div>
              {/* Runway bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--mu)', marginBottom: 5 }}>
                  <span>0 months</span><span>3 months (safe)</span><span>6+ months (excellent)</span>
                </div>
                <div style={{ position: 'relative', height: 12, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(50, (3 / 6) * 100)}%`, background: 'rgba(245,158,11,0.3)', borderRadius: 99 }} />
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (d.cashRunwayMonths / 6) * 100)}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: d.cashRunwayMonths > 3 ? '#10b981' : d.cashRunwayMonths > 1 ? '#f59e0b' : '#ef4444', borderRadius: 99 }} />
                </div>
              </div>
            </motion.div>

            {/* ══ MONTHLY BREAKDOWN TABLE ══ */}
            <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56 }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)' }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Monthly Breakdown</h2>
              </div>

              {/* Desktop */}
              <div className="mobile-table-hide" style={{ overflowX: 'auto' }}>
                <table className="table-base">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24 }}>Month</th>
                      <th>Income</th>
                      <th>Expenses</th>
                      <th>Net</th>
                      <th>I/E Ratio</th>
                      <th style={{ paddingRight: 20 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTable.map((row, i) => {
                      const ratio = row.expenses > 0 ? row.income / row.expenses : row.income > 0 ? 99 : 0
                      const isPositive = row.net >= 0
                      const isCurrent = i === 0
                      return (
                        <tr key={row.label} style={{ background: isCurrent ? 'rgba(99,102,241,0.04)' : undefined }}>
                          <td style={{ paddingLeft: 24, fontWeight: isCurrent ? 700 : 400 }}>
                            {row.label}{isCurrent && <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontWeight: 800 }}>NOW</span>}
                          </td>
                          <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 600, color: '#10b981' }}>{fmt$(row.income)}</td>
                          <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 600, color: '#ff7043' }}>{fmt$(row.expenses)}</td>
                          <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 700, color: isPositive ? '#10b981' : '#ef4444' }}>
                            {isPositive ? '+' : ''}{fmt$(row.net)}
                          </td>
                          <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: ratio >= 1.5 ? '#10b981' : ratio >= 1 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                            {row.expenses > 0 ? ratio.toFixed(2) : '—'}
                          </td>
                          <td style={{ paddingRight: 20 }}>
                            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                              background: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              color: isPositive ? '#10b981' : '#ef4444' }}>
                              {isPositive ? 'Positive' : 'Negative'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="mobile-cards">
                {monthlyTable.slice(0, 6).map((row, i) => (
                  <div key={row.label} className="mobile-card" style={{ background: i === 0 ? 'rgba(99,102,241,0.04)' : undefined }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                        {row.label}
                        {i === 0 && <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontWeight: 800 }}>NOW</span>}
                      </p>
                      <span style={{ fontSize: 14, fontWeight: 900, fontFamily: "DM Mono, monospace", color: row.net >= 0 ? '#10b981' : '#ef4444' }}>
                        {row.net >= 0 ? '+' : ''}{fmt$(row.net, 0)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      <span style={{ color: '#10b981' }}>In: {fmt$(row.income, 0)}</span>
                      <span style={{ color: '#ff7043' }}>Out: {fmt$(row.expenses, 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ══ CASH HEALTH SCORE ══ */}
            <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Cash Health Score</h2>
                  <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Composite score from 6 cash flow factors</p>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 99, background: `${d.healthColor}18`, color: d.healthColor, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {d.healthLabel}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 24, alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 110, height: 110 }}>
                  <svg viewBox="0 0 110 110" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="55" cy="55" r="44" fill="none" stroke="var(--bg3)" strokeWidth="10" />
                    <motion.circle cx="55" cy="55" r="44" fill="none" stroke={d.healthColor} strokeWidth="10"
                      strokeDasharray={`${2 * Math.PI * 44}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 44 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - d.healthScore / 100) }}
                      transition={{ duration: 1.4, ease: 'easeOut' }} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 26, fontWeight: 900, color: d.healthColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
                      <CountUp end={d.healthScore} duration={1.4} />
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--mu)' }}>/100</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Net Cash Position', val: d.netCash >= 0 ? 'Positive' : 'Negative', color: d.netCash >= 0 ? '#10b981' : '#ef4444' },
                    { label: 'Revenue Trend', val: `${d.incomeGrowthPct >= 0 ? '+' : ''}${d.incomeGrowthPct.toFixed(0)}% MoM`, color: d.incomeGrowthPct >= 0 ? '#10b981' : '#ef4444' },
                    { label: 'Cash Runway', val: `${d.cashRunwayMonths.toFixed(1)} months`, color: d.cashRunwayMonths > 3 ? '#10b981' : d.cashRunwayMonths > 1 ? '#f59e0b' : '#ef4444' },
                    { label: 'Income/Expense Ratio', val: d.avgMonthlyExpenses > 0 ? `${(d.avgMonthlyIncome / d.avgMonthlyExpenses).toFixed(2)}×` : '—', color: d.avgMonthlyIncome >= d.avgMonthlyExpenses ? '#10b981' : '#ef4444' },
                    { label: 'Overdue Risk', val: d.overdueAmount > 0 ? fmt$(d.overdueAmount, 0) + ' overdue' : 'None', color: d.overdueAmount > 0 ? '#f59e0b' : '#10b981' },
                  ].map(f => (
                    <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--mu)' }}>{f.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  )
}
