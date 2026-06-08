'use client'
/*
 * TAX INTELLIGENCE CENTER
 * Uses: income, expenses (existing), tax_estimates (existing).
 * No new migration required.
 * All calculations are estimates only — not professional tax advice.
 * Font names with spaces: template literals or double-quoted strings only.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import toast from 'react-hot-toast'
import CountUp from 'react-countup'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type TaxEstimate = {
  id: string; quarter: number; year: number; estimated_amount: number
  saved_amount: number; status: string; due_date?: string; paid_date?: string
}
type IncomeRow  = { date: string; amount: number; category: string }
type ExpenseRow = { date: string; amount: number; category: string; is_deductible: boolean; notes?: string; business_purpose?: string }

/* ─── Constants ──────────────────────────────────────────────────────────── */
const Q_LABELS: Record<number, string> = {
  1: 'Q1 · Jan–Mar', 2: 'Q2 · Apr–May', 3: 'Q3 · Jun–Aug', 4: 'Q4 · Sep–Dec',
}
const Q_DUE: Record<number, (yr: number) => Date> = {
  1: yr => new Date(yr, 3, 15),
  2: yr => new Date(yr, 5, 15),
  3: yr => new Date(yr, 8, 15),
  4: yr => new Date(yr + 1, 0, 15),
}
// Expense categories typically 100% deductible for business use
const FULLY_DEDUCTIBLE_CATS = ['Software','Marketing','Equipment','Professional Services','Insurance','Rent','Utilities','Operations','Office']
// 50% deductible
const HALF_DEDUCTIBLE_CATS  = ['Meals']

const CAT_COLORS = ['#6366f1','#10b981','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#ff7043','#14b8a6','#64748b']

/* ─── Utilities ──────────────────────────────────────────────────────────── */
function fmt$(n: number, dec = 2) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
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
        <span role="tooltip" style={{ position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: 'var(--ink)', lineHeight: 1.6, width: 220, zIndex: 99, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', pointerEvents: 'none', whiteSpace: 'normal', fontWeight: 400 }}>
          {tip}
        </span>
      )}
    </span>
  )
}

/* ─── SavedAmountEditor ──────────────────────────────────────────────────── */
function SavedEditor({ estimate, onSave }: { estimate: TaxEstimate; onSave: (id: string, val: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(estimate.saved_amount))
  if (!editing) return (
    <button onClick={() => setEditing(true)} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}>
      {estimate.saved_amount > 0 ? `${fmt$(estimate.saved_amount)} saved · edit` : 'Add to jar →'}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--mu)' }}>$</span>
      <input autoFocus type="number" min="0" step="0.01" value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(estimate.id, parseFloat(val) || 0); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
        style={{ width: 90, padding: '4px 8px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 8, fontSize: 12, color: 'var(--in-txt)', outline: 'none' }} />
      <button onClick={() => { onSave(estimate.id, parseFloat(val) || 0); setEditing(false) }}
        style={{ fontSize: 10, fontWeight: 800, color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Save</button>
      <button onClick={() => setEditing(false)}
        style={{ fontSize: 10, color: 'var(--mu)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function TaxPage() {
  const year = new Date().getFullYear()

  const [estimates, setEstimates] = useState<TaxEstimate[]>([])
  const [incomeData, setIncomeData]   = useState<IncomeRow[]>([])
  const [expenseData, setExpenseData] = useState<ExpenseRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [userId, setUserId]           = useState('')
  const [exportOpen, setExportOpen]   = useState(false)
  const [creatingEstimates, setCreatingEstimates] = useState(false)
  // Adjustable effective rates (state only, not persisted)
  const [stateRate, setStateRate]     = useState(5)    // percent

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [estRes, incRes, expRes] = await Promise.all([
      sb.from('tax_estimates').select('*').eq('user_id', user.id).eq('year', year).order('quarter'),
      sb.from('income').select('date,amount,category').eq('user_id', user.id),
      sb.from('expenses').select('date,amount,category,is_deductible,notes,business_purpose').eq('user_id', user.id),
    ])
    setEstimates(estRes.data ?? [])
    setIncomeData(incRes.data ?? [])
    setExpenseData(expRes.data ?? [])
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  /* ── Create quarterly estimates if none exist ── */
  async function initEstimates() {
    setCreatingEstimates(true)
    const sb = createClient()
    const rows = [1, 2, 3, 4].map(q => ({
      user_id: userId, quarter: q, year,
      estimated_amount: 0, saved_amount: 0, status: 'pending',
      due_date: Q_DUE[q](year).toISOString().split('T')[0],
    }))
    const { error } = await sb.from('tax_estimates').insert(rows)
    setCreatingEstimates(false)
    if (error) { toast.error('Failed to create estimates'); return }
    toast.success('Quarterly estimates created ✓')
    load()
  }

  async function updateSaved(id: string, saved: number) {
    const sb = createClient()
    await sb.from('tax_estimates').update({ saved_amount: saved }).eq('id', id)
    setEstimates(prev => prev.map(e => e.id === id ? { ...e, saved_amount: saved } : e))
    toast.success('Saved amount updated ✓')
  }

  async function markPaid(id: string) {
    const sb = createClient()
    await sb.from('tax_estimates').update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id)
    setEstimates(prev => prev.map(e => e.id === id ? { ...e, status: 'paid', paid_date: new Date().toISOString().split('T')[0] } : e))
    toast.success('Marked as paid ✓')
  }

  /* ════════════════════════════════════════════════════════════════════
     CENTRALISED COMPUTED DATA — current year only
  ════════════════════════════════════════════════════════════════════ */
  const d = useMemo(() => {
    const now      = new Date()
    const yearStart = new Date(year, 0, 1)
    const yearEnd   = new Date(year, 11, 31, 23, 59, 59)

    /* ── Year-filtered ── */
    const yearIncome  = incomeData.filter(i => { const d = new Date(i.date); return d >= yearStart && d <= yearEnd })
    const yearExpenses = expenseData.filter(e => { const d = new Date(e.date); return d >= yearStart && d <= yearEnd })

    /* ── Income ── */
    const grossIncome = yearIncome.reduce((s, i) => s + Number(i.amount), 0)

    /* ── Expenses + deductions ── */
    const deductibleTotal    = yearExpenses.filter(e => e.is_deductible).reduce((s, e) => s + Number(e.amount), 0)
    const nonDeductibleTotal = yearExpenses.filter(e => !e.is_deductible).reduce((s, e) => s + Number(e.amount), 0)
    const totalExpensesYear  = yearExpenses.reduce((s, e) => s + Number(e.amount), 0)
    const deductionRate      = totalExpensesYear > 0 ? deductibleTotal / totalExpensesYear * 100 : 0

    /* ── Tax calculation (self-employment, US simplified) ── */
    const netSEIncome       = Math.max(0, grossIncome - deductibleTotal)
    // Self-employment tax: 92.35% of net × 15.3%
    const seTax             = netSEIncome * 0.9235 * 0.153
    const halfSETaxDed      = seTax / 2  // above-the-line deduction
    // Adjusted taxable income for income tax
    const taxableIncome     = Math.max(0, netSEIncome - halfSETaxDed)
    // Effective federal income tax rate for small business (~22% bracket)
    const federalIncomeTax  = taxableIncome * 0.22
    const stateTax          = taxableIncome * (stateRate / 100)
    const totalFederalTax   = seTax + federalIncomeTax
    const totalTaxEstimate  = totalFederalTax + stateTax
    const effectiveRate     = grossIncome > 0 ? totalTaxEstimate / grossIncome * 100 : 0
    const quarterlyPayment  = totalTaxEstimate / 4

    /* ── Tax reserve ── */
    const totalSaved   = estimates.reduce((s, e) => s + Number(e.saved_amount), 0)
    const reservePct   = totalTaxEstimate > 0 ? Math.min(100, (totalSaved / totalTaxEstimate) * 100) : 0
    const shortfall    = Math.max(0, totalTaxEstimate - totalSaved)
    const monthsLeft   = Math.max(1, 12 - now.getMonth())
    const monthlySavingsNeeded = shortfall > 0 ? shortfall / monthsLeft : 0

    /* ── Category deduction breakdown ── */
    const catMap: Record<string, { ded: number; nonDed: number }> = {}
    yearExpenses.forEach(e => {
      if (!catMap[e.category]) catMap[e.category] = { ded: 0, nonDed: 0 }
      if (e.is_deductible) catMap[e.category].ded += Number(e.amount)
      else catMap[e.category].nonDed += Number(e.amount)
    })
    const catBreakdown = Object.entries(catMap)
      .sort((a, b) => (b[1].ded + b[1].nonDed) - (a[1].ded + a[1].nonDed))
      .map(([cat, v], idx) => ({ cat, ...v, total: v.ded + v.nonDed, pct: v.ded + v.nonDed > 0 ? v.ded / (v.ded + v.nonDed) * 100 : 0, color: CAT_COLORS[idx % CAT_COLORS.length] }))

    /* ── Missing deductions ── */
    const missingDedOpps: { icon: string; title: string; detail: string; potential: number }[] = []
    // Non-deductible expenses in fully-deductible categories
    const nonDedInBiz = yearExpenses.filter(e => !e.is_deductible && FULLY_DEDUCTIBLE_CATS.includes(e.category))
    if (nonDedInBiz.length > 0) {
      const amt = nonDedInBiz.reduce((s, e) => s + Number(e.amount), 0)
      missingDedOpps.push({ icon: '💼', title: 'Business expenses not marked deductible', detail: `${fmt$(amt)} in ${FULLY_DEDUCTIBLE_CATS.filter(c => nonDedInBiz.some(e => e.category === c)).join(', ')} expenses may qualify as 100% deductions.`, potential: amt * 0.25 })
    }
    // Meals — only 50% deductible but may be unmarked
    const nonDedMeals = yearExpenses.filter(e => e.category === 'Meals' && !e.is_deductible)
    if (nonDedMeals.length > 0) {
      const amt = nonDedMeals.reduce((s, e) => s + Number(e.amount), 0) * 0.5
      missingDedOpps.push({ icon: '🍽️', title: 'Business meals — 50% deductible', detail: `Business meals are 50% deductible with proper documentation (who attended, business purpose).`, potential: amt * 0.25 })
    }
    // Expenses with no notes/purpose (may be hard to defend)
    const noNotes = yearExpenses.filter(e => e.is_deductible && !e.notes && !e.business_purpose)
    if (noNotes.length >= 3) {
      missingDedOpps.push({ icon: '📄', title: 'Deductible expenses missing business purpose', detail: `${noNotes.length} deductible expenses have no notes or purpose documented. IRS may require documentation for expenses over $75.`, potential: 0 })
    }

    /* ── Monthly income chart (for year) ── */
    const monthlyChart = Array.from({ length: now.getMonth() + 1 }, (_, i) => {
      const mStart = new Date(year, i, 1)
      const mEnd   = new Date(year, i + 1, 0, 23, 59, 59)
      const inc    = yearIncome.filter(x => { const d = new Date(x.date); return d >= mStart && d <= mEnd }).reduce((s, x) => s + Number(x.amount), 0)
      const ded    = yearExpenses.filter(x => x.is_deductible && (() => { const d = new Date(x.date); return d >= mStart && d <= mEnd })()).reduce((s, x) => s + Number(x.amount), 0)
      return { label: mStart.toLocaleString('default', { month: 'short' }), income: inc, deductions: ded }
    })

    /* ── Projection (extrapolate to year end) ── */
    const monthsElapsed   = now.getMonth() + 1
    const projectedAnnualIncome     = monthsElapsed > 0 ? grossIncome / monthsElapsed * 12 : 0
    const projectedAnnualDeductions = monthsElapsed > 0 ? deductibleTotal / monthsElapsed * 12 : 0
    const projectedNetSE    = Math.max(0, projectedAnnualIncome - projectedAnnualDeductions)
    const projectedSETax    = projectedNetSE * 0.9235 * 0.153
    const projectedHalfSED  = projectedSETax / 2
    const projectedTaxable  = Math.max(0, projectedNetSE - projectedHalfSED)
    const projectedTotalTax = projectedSETax + projectedTaxable * 0.22 + projectedTaxable * (stateRate / 100)

    /* ── Filing readiness score ── */
    let readiness = 0
    if (grossIncome > 0)              readiness += 20 // has income
    if (totalExpensesYear > 0)        readiness += 15 // has expenses
    if (deductionRate > 40)           readiness += 15 // deductions being tracked
    if (estimates.length >= 4)        readiness += 20 // quarterly estimates created
    if (totalSaved > 0)               readiness += 15 // saving for taxes
    if (reservePct >= 50)             readiness += 15 // meaningful reserves built
    readiness = Math.min(100, readiness)
    const readinessLabel = readiness >= 80 ? 'Ready to File' : readiness >= 60 ? 'On Track' : readiness >= 40 ? 'Getting There' : 'Needs Attention'
    const readinessColor = readiness >= 80 ? '#10b981' : readiness >= 60 ? '#0ea5e9' : readiness >= 40 ? '#f59e0b' : '#ef4444'

    return {
      grossIncome, deductibleTotal, nonDeductibleTotal, totalExpensesYear,
      deductionRate, netSEIncome, seTax, halfSETaxDed,
      taxableIncome, federalIncomeTax, stateTax, totalFederalTax, totalTaxEstimate,
      effectiveRate, quarterlyPayment,
      totalSaved, reservePct, shortfall, monthlySavingsNeeded,
      catBreakdown, missingDedOpps, monthlyChart,
      projectedAnnualIncome, projectedAnnualDeductions, projectedTotalTax,
      readiness, readinessLabel, readinessColor,
    }
  }, [incomeData, expenseData, estimates, year, stateRate])

  /* ── Exports ── */
  function exportCsv(rows: Record<string, unknown>[], fn: string) {
    if (!rows.length) { toast.error('No data to export'); return }
    const h = Object.keys(rows[0])
    const csv = [h.join(','), ...rows.map(r => h.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = fn; a.click()
    toast.success(`${fn} exported ✓`); setExportOpen(false)
  }
  const exportSummary   = () => exportCsv([
    { metric: 'Tax Year', value: year },
    { metric: 'Gross Income', value: d.grossIncome.toFixed(2) },
    { metric: 'Deductible Expenses', value: d.deductibleTotal.toFixed(2) },
    { metric: 'Net SE Income', value: d.netSEIncome.toFixed(2) },
    { metric: 'SE Tax (est.)', value: d.seTax.toFixed(2) },
    { metric: 'Half SE Tax Deduction', value: d.halfSETaxDed.toFixed(2) },
    { metric: 'Taxable Income (adj.)', value: d.taxableIncome.toFixed(2) },
    { metric: 'Federal Income Tax (est.)', value: d.federalIncomeTax.toFixed(2) },
    { metric: `State Tax (est. ${stateRate}%)`, value: d.stateTax.toFixed(2) },
    { metric: 'Total Tax Estimate', value: d.totalTaxEstimate.toFixed(2) },
    { metric: 'Amount Saved', value: d.totalSaved.toFixed(2) },
    { metric: 'Shortfall', value: d.shortfall.toFixed(2) },
    { metric: 'Filing Readiness Score', value: `${d.readiness}/100` },
  ], `tax_summary_${year}.csv`)
  const exportDeductions = () => exportCsv(expenseData.filter(e => e.is_deductible && new Date(e.date).getFullYear() === year).map(e => ({ date: e.date, category: e.category, amount: Number(e.amount).toFixed(2), notes: e.notes || '', business_purpose: e.business_purpose || '' })), `deductions_${year}.csv`)
  const exportQuarterly  = () => exportCsv(estimates.map(e => ({ quarter: Q_LABELS[e.quarter], estimated: d.quarterlyPayment.toFixed(2), saved: Number(e.saved_amount).toFixed(2), status: e.status, due_date: e.due_date || '', paid_date: e.paid_date || '' })), `quarterly_estimates_${year}.csv`)

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 44, width: 280, marginBottom: 28 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          {[...Array(6)].map((_, i) => <div key={i} style={{ height: 90 }} className="skeleton" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} style={{ height: 200, marginBottom: 20 }} className="skeleton" />)}
      </div>
    )
  }

  const iStyle: React.CSSProperties = { padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit' }

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ══ HEADER ══ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Tax Intelligence</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>
              Stay ready for every quarterly deadline. No April surprises.
            </p>
            <p style={{ fontSize: 11, color: 'var(--mu2)', marginTop: 4 }}>
              ⚠️ All figures are estimates only. Consult a tax professional for filing.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--bd)' }}>
              <span style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 600 }}>Tax Year</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{year}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap' }}>State rate</span>
              <div style={{ position: 'relative' }}>
                <input type="number" min="0" max="15" step="0.5" value={stateRate}
                  onChange={e => setStateRate(parseFloat(e.target.value) || 0)}
                  style={{ ...iStyle, width: 64, padding: '6px 24px 6px 10px', fontSize: 13 }} />
                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--mu)', pointerEvents: 'none' }}>%</span>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" onClick={() => setExportOpen(s => !s)} style={{ minHeight: 44 }}>⬇ Export</button>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ position: 'absolute', top: '110%', right: 0, width: 220, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', zIndex: 40, padding: 8 }}>
                    {[
                      { label: `Tax Summary ${year} (CSV)`,     fn: exportSummary },
                      { label: `Deductions ${year} (CSV)`,      fn: exportDeductions },
                      { label: `Quarterly Estimates (CSV)`,     fn: exportQuarterly },
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

        {/* ══ 6 KPI CARDS ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Gross Income',       value: d.grossIncome,       prefix: '$', color: '#10b981', icon: '💰', tip: `All income recorded in ${year} before any deductions.` },
            { label: 'Tax Deductions',     value: d.deductibleTotal,   prefix: '$', color: '#6366f1', icon: '✅', sub: `${d.deductionRate.toFixed(0)}% of expenses`, tip: 'Deductible business expenses that reduce your taxable income.' },
            { label: 'Taxable Income',     value: d.taxableIncome,     prefix: '$', color: '#f59e0b', icon: '📊', tip: 'Net self-employment income minus the half-SE-tax deduction. This is what income tax is applied to.' },
            { label: 'Est. Total Tax',     value: d.totalTaxEstimate,  prefix: '$', color: '#ef4444', icon: '🧮', sub: `${d.effectiveRate.toFixed(1)}% effective rate`, tip: `Estimated SE tax + federal income tax (22%) + state tax (${stateRate}%). An estimate only.` },
            { label: 'Amount Saved',       value: d.totalSaved,        prefix: '$', color: d.reservePct >= 100 ? '#10b981' : '#8b5cf6', icon: '🏦', sub: `${d.reservePct.toFixed(0)}% of target`, tip: 'Total amount you have set aside across all quarterly estimates.' },
            { label: 'Filing Readiness',   value: d.readiness,         prefix: '', suffix: '/100', decimals: 0, color: d.readinessColor, icon: '📋', sub: d.readinessLabel, subColor: d.readinessColor, tip: 'How prepared you are to file — based on records, estimates, deductions, and savings.' },
          ].map((s, i) => (
            <motion.div key={s.label} className="stat-card"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
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

        {/* ══ FILING READINESS + TAX JAR ══ */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

          {/* Filing Readiness Score */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Filing Readiness</h2>
              <span style={{ padding: '3px 10px', borderRadius: 99, background: `${d.readinessColor}18`, color: d.readinessColor, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.readinessLabel}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 18 }}>
              <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                <svg viewBox="0 0 90 90" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="45" cy="45" r="37" fill="none" stroke="var(--bg3)" strokeWidth="8" />
                  <motion.circle cx="45" cy="45" r="37" fill="none" stroke={d.readinessColor} strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 37}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 37 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 37 * (1 - d.readiness / 100) }}
                    transition={{ duration: 1.3, ease: 'easeOut' }} strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: d.readinessColor, lineHeight: 1 }}><CountUp end={d.readiness} duration={1.3} /></span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { label: 'Income recorded',       done: d.grossIncome > 0 },
                  { label: 'Expenses recorded',     done: d.totalExpensesYear > 0 },
                  { label: 'Deductions tracked',    done: d.deductionRate > 40 },
                  { label: 'Quarterly estimates',   done: estimates.length >= 4 },
                  { label: 'Savings started',       done: d.totalSaved > 0 },
                  { label: 'Reserve ≥ 50%',         done: d.reservePct >= 50 },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, flexShrink: 0 }}>{f.done ? '✅' : '⬜'}</span>
                    <span style={{ fontSize: 11, color: f.done ? 'var(--ink)' : 'var(--mu)', fontWeight: f.done ? 600 : 400 }}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Tax Jar (Reserve) */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 240px', minWidth: 0, textAlign: 'center' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
            <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 4 }}>Tax Reserve Jar</h2>
            <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 20 }}>How ready are you for tax season?</p>
            <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 16px' }}>
              <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg3)" strokeWidth="12" />
                <motion.circle cx="60" cy="60" r="50" fill="none"
                  stroke={d.reservePct >= 100 ? '#10b981' : d.reservePct >= 50 ? '#f59e0b' : '#6366f1'} strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - d.reservePct / 100) }}
                  transition={{ duration: 1.2, ease: 'easeOut' }} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 26 }}>{d.reservePct >= 100 ? '✅' : d.reservePct >= 50 ? '😊' : '😅'}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{d.reservePct.toFixed(0)}%</span>
              </div>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{fmt$(d.totalSaved)} saved</p>
            <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 16 }}>of {fmt$(d.totalTaxEstimate)} estimated</p>
            {d.reservePct < 100 && d.shortfall > 0 && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12 }}>
                <p style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 3 }}>{fmt$(d.shortfall, 0)} to save</p>
                <p style={{ color: 'var(--mu)' }}>≈ {fmt$(d.monthlySavingsNeeded, 0)}/mo for the next {Math.max(1, 12 - new Date().getMonth())} months</p>
              </div>
            )}
            {d.reservePct >= 100 && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                Tax ready! No April stress 😌
              </div>
            )}
          </motion.div>

          {/* Self-Employment Tax Breakdown */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 240px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Tax Breakdown</h2>
              <InfoIcon tip="Self-employed individuals pay both the employer and employee portions of Social Security and Medicare (SE tax = 15.3%) plus regular income tax. This is an estimate only." />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Gross Income',              val: d.grossIncome,     color: '#10b981' },
                { label: '− Business Deductions',     val: -d.deductibleTotal, color: '#6366f1', sign: true },
                { label: '= Net SE Income',           val: d.netSEIncome,     color: 'var(--ink)', bold: true },
                { label: 'SE Tax (15.3%)',             val: d.seTax,           color: '#ef4444' },
                { label: '− ½ SE Tax Deduction',      val: -d.halfSETaxDed,   color: '#6366f1', sign: true },
                { label: 'Taxable Income (adj.)',      val: d.taxableIncome,   color: 'var(--ink)', bold: true },
                { label: 'Federal Income Tax (~22%)',  val: d.federalIncomeTax, color: '#ef4444' },
                { label: `State Tax (~${stateRate}%)`, val: d.stateTax,        color: '#f59e0b' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: r.bold ? '6px 8px' : '4px 0', borderRadius: r.bold ? 8 : 0, background: r.bold ? 'var(--bg3)' : 'transparent' }}>
                  <span style={{ fontSize: 11, color: 'var(--mu)', fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: r.bold ? 800 : 600, color: r.color, fontFamily: "DM Mono, monospace" }}>
                    {r.val < 0 ? '-' : ''}{fmt$(Math.abs(r.val))}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>Total Estimated Tax</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#ef4444', fontFamily: "DM Mono, monospace" }}>{fmt$(d.totalTaxEstimate)}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ══ QUARTERLY ESTIMATES ══ */}
        <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Quarterly Estimated Payments — {year}</h2>
              <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>US self-employed quarterly deadlines. Set aside ~25% per quarter.</p>
            </div>
            {estimates.length === 0 && (
              <button className="btn-primary" disabled={creatingEstimates} onClick={initEstimates} style={{ fontSize: 12, padding: '8px 16px' }}>
                {creatingEstimates ? 'Creating…' : '+ Initialize Estimates'}
              </button>
            )}
          </div>

          {estimates.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--mu)' }}>
              <p style={{ fontSize: 28, marginBottom: 10 }}>📋</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>No quarterly estimates yet</p>
              <p style={{ fontSize: 12, marginBottom: 16 }}>Initialize all 4 quarterly estimates for {year} to start tracking your tax savings progress.</p>
              <button className="btn-primary" disabled={creatingEstimates} onClick={initEstimates} style={{ fontSize: 13 }}>
                {creatingEstimates ? 'Creating…' : 'Initialize 4 Quarterly Estimates →'}
              </button>
            </div>
          ) : (
            <div>
              {/* Desktop */}
              <div className="mobile-table-hide">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24 }}>Quarter</th>
                      <th>Due Date</th>
                      <th>Est. Payment</th>
                      <th>Amount Saved</th>
                      <th>Progress</th>
                      <th>Status</th>
                      <th style={{ paddingRight: 24 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.map(e => {
                      const qTax    = d.quarterlyPayment
                      const saved   = Number(e.saved_amount)
                      const pct     = qTax > 0 ? Math.min(100, saved / qTax * 100) : 0
                      const isDue   = e.due_date && new Date(e.due_date) < new Date() && e.status !== 'paid'
                      const daysUntil = e.due_date ? Math.round((new Date(e.due_date).getTime() - Date.now()) / 86400000) : null
                      return (
                        <tr key={e.id}>
                          <td style={{ paddingLeft: 24 }}>
                            <p style={{ fontWeight: 600, fontSize: 13 }}>{Q_LABELS[e.quarter]}</p>
                          </td>
                          <td>
                            <p style={{ fontSize: 12, color: isDue ? '#ef4444' : 'var(--mu)', fontWeight: isDue ? 700 : 400 }}>
                              {e.due_date ? new Date(e.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </p>
                            {daysUntil !== null && e.status !== 'paid' && (
                              <p style={{ fontSize: 10, color: daysUntil < 0 ? '#ef4444' : daysUntil < 14 ? '#f59e0b' : 'var(--mu2)', fontWeight: 700 }}>
                                {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Today' : `In ${daysUntil}d`}
                              </p>
                            )}
                          </td>
                          <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{fmt$(qTax)}</td>
                          <td>
                            <SavedEditor estimate={e} onSave={updateSaved} />
                          </td>
                          <td style={{ width: 140 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="progress-track" style={{ flex: 1, height: 6 }}>
                                <motion.div className="progress-fill" initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                                  style={{ background: pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#6366f1' }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 100 ? '#10b981' : 'var(--mu)', minWidth: 32 }}>{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td><span className={`status-pill status-${e.status === 'paid' ? 'paid' : isDue ? 'overdue' : 'pending'}`}>{e.status}</span></td>
                          <td style={{ paddingRight: 24 }}>
                            {e.status !== 'paid' && (
                              <button onClick={() => markPaid(e.id)} className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>Mark Paid</button>
                            )}
                            {e.status === 'paid' && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓ Paid {e.paid_date ? new Date(e.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="mobile-cards">
                {estimates.map(e => {
                  const qTax  = d.quarterlyPayment
                  const saved = Number(e.saved_amount)
                  const pct   = qTax > 0 ? Math.min(100, saved / qTax * 100) : 0
                  const isDue = e.due_date && new Date(e.due_date) < new Date() && e.status !== 'paid'
                  return (
                    <div key={e.id} className="mobile-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{Q_LABELS[e.quarter]}</p>
                          <p style={{ fontSize: 11, color: isDue ? '#ef4444' : 'var(--mu)', marginTop: 2 }}>
                            Due: {e.due_date ? new Date(e.due_date).toLocaleDateString() : '—'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontFamily: "DM Mono, monospace", fontWeight: 700, color: '#ef4444', fontSize: 14 }}>{fmt$(qTax)}</p>
                          <span className={`status-pill status-${e.status === 'paid' ? 'paid' : isDue ? 'overdue' : 'pending'}`} style={{ marginTop: 4, display: 'inline-block' }}>{e.status}</span>
                        </div>
                      </div>
                      <div className="progress-track" style={{ marginBottom: 8 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : '#6366f1', transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <SavedEditor estimate={e} onSave={updateSaved} />
                        {e.status !== 'paid' && <button onClick={() => markPaid(e.id)} style={{ fontSize: 12, color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Mark Paid →</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>

        {/* ══ DEDUCTION CENTER + MISSING DEDUCTIONS ══ */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

          {/* Deduction Center */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Deduction Center</h2>
              <InfoIcon tip={`Deductible expenses reduce your taxable income — saving you ~25 cents per dollar deducted. You have claimed ${d.deductionRate.toFixed(0)}% of ${year} expenses as deductible.`} />
            </div>
            {d.catBreakdown.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>✅</p>
                <p style={{ fontSize: 12 }}>No expenses recorded for {year} yet.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                  <div style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 4 }}>Deductible</p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: '#6366f1', fontFamily: "DM Mono, monospace" }}>{fmt$(d.deductibleTotal)}</p>
                  </div>
                  <div style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,112,67,0.08)', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 4 }}>Non-Deductible</p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: '#ff7043', fontFamily: "DM Mono, monospace" }}>{fmt$(d.nonDeductibleTotal)}</p>
                  </div>
                  <div style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 4 }}>Tax Saved</p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: '#10b981', fontFamily: "DM Mono, monospace" }}>{fmt$(d.deductibleTotal * 0.25)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {d.catBreakdown.slice(0, 7).map(c => (
                    <div key={c.cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.cat}</span>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span style={{ color: '#6366f1', fontFamily: "DM Mono, monospace" }}>{fmt$(c.ded)}</span>
                          {c.nonDed > 0 && <span style={{ color: '#ff7043', fontFamily: "DM Mono, monospace" }}>-{fmt$(c.nonDed)}</span>}
                        </div>
                      </div>
                      <div className="progress-track" style={{ height: 5 }}>
                        <div className="progress-fill" style={{ width: `${c.pct}%`, background: c.pct > 70 ? '#10b981' : c.pct > 30 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <p style={{ fontSize: 9, color: 'var(--mu)', marginTop: 2 }}>{c.pct.toFixed(0)}% deductible</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          {/* Missing Deductions */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 260px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.49 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Missing Deductions</h2>
              <InfoIcon tip="Expenses that may qualify for deductions but aren't currently marked as deductible. Review with your accountant." />
            </div>
            {d.missingDedOpps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>✅</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>No obvious missed deductions</p>
                <p style={{ fontSize: 12 }}>Your expense categorisation looks complete.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {d.missingDedOpps.map((o, i) => (
                  <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{o.icon}</span>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{o.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>{o.detail}</p>
                      </div>
                    </div>
                    {o.potential > 0 && (
                      <p style={{ fontSize: 12, fontWeight: 800, color: '#10b981', paddingLeft: 28 }}>~{fmt$(o.potential, 0)} potential tax saving</p>
                    )}
                  </div>
                ))}
                <p style={{ fontSize: 10, color: 'var(--mu2)', lineHeight: 1.5 }}>
                  ⚠️ Review with a qualified tax professional before reclassifying. Rules vary by jurisdiction.
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* ══ INCOME CHART + TAX FORECAST ══ */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

          {/* Monthly Income Chart */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 300px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
            <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 4 }}>
              {year} Income vs Deductions
            </h2>
            <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 16 }}>Month-by-month for the current tax year</p>
            {d.monthlyChart.length === 0 || d.monthlyChart.every(m => m.income === 0) ? (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mu)', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 28 }}>📊</span>
                <p style={{ fontSize: 12 }}>No income recorded for {year} yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={d.monthlyChart} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--mu)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--mu)' }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v) => [fmt$(Number(v)), '']} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, fontSize: 11 }} />
                  <Bar dataKey="income"     name="Income"     fill="#10b981" radius={[4,4,0,0]} animationBegin={200} animationDuration={700} />
                  <Bar dataKey="deductions" name="Deductions"  fill="#6366f1" radius={[4,4,0,0]} animationBegin={300} animationDuration={700} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Annual Projection */}
          <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 240px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Annual Projection</h2>
              <InfoIcon tip={`Extrapolated from your first ${new Date().getMonth() + 1} months of ${year}. A straight-line estimate only.`} />
            </div>
            {d.grossIncome === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                <p style={{ fontSize: 12 }}>Add income for {year} to see your annual projection.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Projected Annual Income',     val: d.projectedAnnualIncome,     color: '#10b981' },
                  { label: 'Projected Deductions',        val: d.projectedAnnualDeductions,  color: '#6366f1' },
                  { label: 'Projected Taxable Income',    val: Math.max(0, d.projectedAnnualIncome - d.projectedAnnualDeductions), color: '#f59e0b' },
                  { label: 'Projected Total Tax (est.)',  val: d.projectedTotalTax,          color: '#ef4444' },
                ].map(r => (
                  <div key={r.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)' }}>
                    <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 4 }}>{r.label}</p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: r.color, fontFamily: "DM Mono, monospace" }}>{fmt$(r.val, 0)}</p>
                  </div>
                ))}
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>
                  💡 To meet the projected tax bill, set aside {fmt$(d.projectedTotalTax / 12, 0)}/mo or {fmt$(d.projectedTotalTax / 4, 0)}/quarter.
                </div>
                <p style={{ fontSize: 9, color: 'var(--mu2)', textAlign: 'center' }}>Estimates only. Not financial or tax advice.</p>
              </div>
            )}
          </motion.div>
        </div>

      </motion.div>
    </div>
  )
}
