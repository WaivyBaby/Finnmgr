'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CountUp from 'react-countup'
import { motion, AnimatePresence } from 'framer-motion'
import ReactConfetti from 'react-confetti'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import {
  IncomeModal, ExpenseModal, InvoiceModal, ClientModal, DocumentModal, BudgetModal,
  type ModalClient,
} from '@/components/modals/FinnMgrModals'

/* ── Static demo data ─────────────────────────────────────────────────────── */
const DEMO = {
  revenue: 18450, expenses: 6820, profit: 11630,
  cash: 34200, taxReserve: 2140, outstanding: 8750,
  clients: 7, documents: 24,
  monthlyExpenses: 6820, // used for runway calculation
}

const MONTHLY_DATA = [
  { label: 'Jan', income: 12400, expenses: 5200, profit: 7200 },
  { label: 'Feb', income: 14200, expenses: 5800, profit: 8400 },
  { label: 'Mar', income: 13100, expenses: 6100, profit: 7000 },
  { label: 'Apr', income: 15900, expenses: 6400, profit: 9500 },
  { label: 'May', income: 17300, expenses: 6700, profit: 10600 },
  { label: 'Jun', income: 18450, expenses: 6820, profit: 11630 },
]

const QUARTERLY_DATA = [
  { label: 'Q1', income: 39700, expenses: 17100, profit: 22600 },
  { label: 'Q2', income: 51650, expenses: 19920, profit: 31730 },
]

const CASHFLOW_DATA = [
  { label: 'Jan', inflow: 12400, outflow: 8200, projected: 13000 },
  { label: 'Feb', inflow: 14200, outflow: 9100, projected: 14500 },
  { label: 'Mar', inflow: 13100, outflow: 8800, projected: 14000 },
  { label: 'Apr', inflow: 15900, outflow: 9400, projected: 16200 },
  { label: 'May', inflow: 17300, outflow: 9700, projected: 17800 },
  { label: 'Jun', inflow: 18450, outflow: 10100, projected: 19000 },
]

const GOALS = [
  { label: 'Revenue Goal', current: 18450, target: 20000, color: '#10b981', prefix: '$' },
  { label: 'Tax Savings', current: 2140, target: 2140, color: '#6366f1', prefix: '$' },
  { label: 'New Clients', current: 7, target: 10, color: '#0ea5e9', prefix: '' },
  { label: 'Invoice Rate', current: 82, target: 95, color: '#f59e0b', prefix: '' },
]

const CONNECTED_APPS = [
  { name: 'Stripe', icon: '💳', status: 'connected', color: '#635bff' },
  { name: 'PayPal', icon: '🅿️', status: 'connect', color: '#003087' },
  { name: 'Shopify', icon: '🛒', status: 'soon', color: '#96bf48' },
  { name: 'QuickBooks', icon: '📚', status: 'soon', color: '#2ca01c' },
  { name: 'Plaid', icon: '🏦', status: 'soon', color: '#0052ff' },
  { name: 'Zapier', icon: '⚡', status: 'soon', color: '#ff4a00' },
]

const LEARN_CONTENT: Record<string, { title: string; def: string; example: string; tips: string[] }> = {
  health: { title: 'Business Health Score', def: 'A composite score (0–100) based on cash flow stability, invoice collection rate, expense ratio, and client diversity.', example: 'A score of 82 means your business is in excellent shape — above the 80 threshold for "strong business health."', tips: ['Reduce overdue invoices to boost collection rate', 'Keep expenses below 40% of revenue', 'Diversify across at least 5 active clients'] },
  revenue: { title: 'Revenue', def: 'Total money earned from all business activities before any deductions or expenses.', example: '$18,450 revenue in June means you invoiced and collected that amount from clients this month.', tips: ['Track monthly to spot seasonal trends', 'Set a 10% month-over-month growth target', 'Identify your highest-margin service'] },
  cashflow: { title: 'Cash Flow', def: 'The net movement of money in and out of your business over a period of time.', example: 'If you received $18,450 but paid $10,100 in expenses, your net cash flow is +$8,350.', tips: ['Keep 3 months of expenses as a cash reserve', 'Invoice on completion, not end of month', 'Use 30-day payment terms at most'] },
  profit: { title: 'Net Profit', def: 'Revenue minus all operating expenses. What your business actually keeps after paying all costs.', example: '$18,450 revenue − $6,820 expenses = $11,630 net profit (63% margin).', tips: ['Aim for 40%+ profit margin for services', 'Review expenses quarterly for cuts', 'Reinvest 20% into growth activities'] },
  invoices: { title: 'Outstanding Invoices', def: 'Money clients owe you that has not been paid yet. These are sent invoices awaiting payment.', example: '$8,750 outstanding means clients owe you that amount across unpaid invoices.', tips: ['Send reminders at 7, 14, and 30 days', 'Offer 2% discount for early payment', 'Require 50% deposit on new projects'] },
  tax: { title: 'Tax Reserve', def: 'Money set aside to pay estimated quarterly taxes. Do not spend this — it belongs to the IRS.', example: 'With $11,630 profit, you should set aside ~$2,900 (25%) for taxes. You have $2,140 saved.', tips: ['Set aside 25-30% of every payment received', 'Pay quarterly to avoid IRS penalties', 'Track deductible expenses to reduce taxable income'] },
  clients: { title: 'Active Clients', def: 'Clients you have worked with in the last 90 days — people who are currently generating revenue.', example: '7 active clients at $18,450 revenue = $2,636 average revenue per client.', tips: ['Aim for 10+ clients to reduce concentration risk', 'Identify your top 3 and upsell them', 'Reconnect with dormant clients quarterly'] },
  docs: { title: 'Document Vault', def: 'Secure storage for contracts, receipts, tax docs, and business records. IRS requires 7 years of records.', example: '24 documents stored includes 6 invoices, 8 receipts, 4 contracts, and 6 tax documents.', tips: ['Upload receipts same day as purchase', 'Store signed contracts immediately', 'Organize by year and category'] },
  expenses: { title: 'Expenses', def: 'All costs incurred to operate your business, both fixed and variable, before calculating profit.', example: '$6,820 in expenses this month across software, marketing, and operations.', tips: ['Review subscriptions monthly — cancel unused ones', 'Categorize everything for tax deductions', 'Keep personal and business expenses separate'] },
  afford: { title: 'Can I Afford This?', def: 'Estimates how a purchase may affect your business cash position and runway — so you can make informed spending decisions.', example: 'With $34,200 cash and $6,820/month expenses, spending $5,000 leaves 4.3 months of runway.', tips: ['Keep 3 months of expenses as a cash reserve (~$20,000)', 'Green = purchase leaves 3+ months runway', 'Amber = 1–3 months runway remaining', 'Red = less than 1 month runway — risky'] },
  forecast: { title: 'Forecast Scenarios', def: 'Estimated future finances based on current trends. Helps you plan for different outcomes.', example: 'Best case assumes 20% revenue growth and 10% expense reduction. Worst case is the inverse.', tips: ['Plan for worst case — it forces smart reserves', 'Use best case for stretch goals only', 'Re-forecast every quarter with real data'] },
}

type Modal = 'income' | 'expense' | 'invoice' | 'client' | 'document' | 'budget' | null
type LearnTopic = keyof typeof LEARN_CONTENT | null
type ChartView = 'monthly' | 'quarterly'
type Scenario = 'expected' | 'best' | 'worst'

const CHECKLIST_KEY = 'finnmgr_checklist'
const CHECKLIST_ITEMS = [
  'Complete your profile', 'Add your first client', 'Create your first invoice',
  'Record your first income', 'Log your first expense', 'Upload a document', 'Set your budget',
]

/* ── Chart tooltip ────────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: '0.75rem' }}>
      <p style={{ fontWeight: 800, marginBottom: 6, color: 'var(--ink)' }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>{p.name}: ${Number(p.value).toLocaleString()}</p>)}
    </div>
  )
}

/* ── Info icon button ─────────────────────────────────────────────────────── */
function InfoIcon({ topic, onLearn, tooltip }: { topic: LearnTopic; onLearn: (t: LearnTopic) => void; tooltip: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onLearn(topic) }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        aria-label={`Learn about ${tooltip}`}
        style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--bg3)', border: '1px solid var(--bd2)',
          color: 'var(--mu)', fontSize: 10, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.15s', lineHeight: 1,
        }}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onMouseDown={e => { e.stopPropagation(); e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.color = '#fff' }}
        onMouseUp={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '' }}
      >
        ⓘ
      </button>
      {show && (
        <span role="tooltip" style={{
          position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10,
          padding: '8px 12px', fontSize: '0.7rem', color: 'var(--ink)', lineHeight: 1.6,
          width: 200, zIndex: 999, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          pointerEvents: 'none', whiteSpace: 'normal', fontWeight: 400,
        }}>
          {tooltip}
          <span style={{ display: 'block', marginTop: 4, color: '#6366f1', fontWeight: 700, fontSize: '0.65rem' }}>Click to learn more →</span>
        </span>
      )}
    </span>
  )
}

/* ── Learn panel ─────────────────────────────────────────────────────────── */
function LearnPanel({ topic, onClose }: { topic: LearnTopic; onClose: () => void }) {
  const content = topic ? LEARN_CONTENT[topic] : null
  if (!content) return null
  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 280 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
        <h3 style={{ fontWeight: 900, fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{content.title}</h3>
        <button onClick={onClose} aria-label="Close learn panel" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1', marginBottom: 8 }}>Definition</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--ink)', lineHeight: 1.7 }}>{content.def}</p>
        </div>
        <div style={{ marginBottom: 20, padding: '14px 16px', background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.15)' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1', marginBottom: 8 }}>Example</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--ink)', lineHeight: 1.7 }}>{content.example}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1', marginBottom: 10 }}>Tips</p>
          {content.tips.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.65rem', color: '#fff', fontWeight: 800 }}>{i + 1}</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--ink)', lineHeight: 1.6 }}>{t}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('there')
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ModalClient[]>([])

  const [modal, setModal] = useState<Modal>(null)
  const [learnTopic, setLearnTopic] = useState<LearnTopic>(null)
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null)
  const [chartView, setChartView] = useState<ChartView>('monthly')
  const [scenario, setScenario] = useState<Scenario>('expected')
  const [affordAmt, setAffordAmt] = useState('')
  const [confetti, setConfetti] = useState(false)
  const [checklist, setChecklist] = useState<boolean[]>(Array(7).fill(false))
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')
  const [cmdIdx, setCmdIdx] = useState(0)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      setUserName(user.user_metadata?.full_name?.split(' ')[0] ?? 'there')
      const { data: cData } = await sb.from('clients').select('id,name,email,payment_terms,address,company').eq('user_id', user.id)
      setClients((cData ?? []) as ModalClient[])
    }).finally(() => setLoading(false))
    try { const s = localStorage.getItem(CHECKLIST_KEY); if (s) setChecklist(JSON.parse(s)) } catch {}
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); setCmdQuery(''); setCmdIdx(0) }
      if (e.key === 'Escape') { setCmdOpen(false); setLearnTopic(null) }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  function greet(name: string) {
    const h = new Date().getHours()
    if (h < 12) return `Good morning, ${name} ☀️`
    if (h < 17) return `Good afternoon, ${name} 👋`
    if (h < 21) return `Good evening, ${name} 🌆`
    return `You're up late, ${name} 🌙`
  }

  function tick(i: number) {
    const n = [...checklist]; n[i] = !n[i]; setChecklist(n)
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(n)) } catch {}
    if (n.every(Boolean)) { setConfetti(true); toast.success("Setup complete! You're officially in business 🎉"); setTimeout(() => setConfetti(false), 6000) }
  }

  /* ── Affordability calculation ── */
  const amt = parseFloat(affordAmt) || 0
  const cashRemaining = DEMO.cash - amt
  const runwayMonths = cashRemaining > 0 ? (cashRemaining / DEMO.monthlyExpenses) : 0
  const currentRunway = DEMO.cash / DEMO.monthlyExpenses

  const affordResult = amt === 0 ? null : (() => {
    if (cashRemaining < 0) return {
      verdict: 'Cannot afford this purchase.', verdictColor: '#ef4444',
      risk: 'Cannot Afford', riskBg: 'rgba(239,68,68,0.15)', riskColor: '#ef4444',
      resultBg: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)',
    }
    if (runwayMonths >= 3) return {
      verdict: 'Yes, you can comfortably afford this.', verdictColor: '#10b981',
      risk: 'Low Risk', riskBg: 'rgba(16,185,129,0.12)', riskColor: '#10b981',
      resultBg: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)',
    }
    if (runwayMonths >= 1) return {
      verdict: 'Possible, but this will tighten your cash position.', verdictColor: '#f59e0b',
      risk: 'Moderate Risk', riskBg: 'rgba(245,158,11,0.12)', riskColor: '#f59e0b',
      resultBg: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)',
    }
    return {
      verdict: 'Not recommended — this reduces your runway below safe levels.', verdictColor: '#ef4444',
      risk: 'High Risk', riskBg: 'rgba(239,68,68,0.12)', riskColor: '#ef4444',
      resultBg: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.25)',
    }
  })()

  /* ── Forecast ── */
  const sm = scenario === 'best' ? 1.2 : scenario === 'worst' ? 0.8 : 1
  const em = scenario === 'best' ? 0.9 : scenario === 'worst' ? 1.15 : 1
  const fIncome = DEMO.revenue * sm
  const fExpenses = DEMO.expenses * em
  const fProfit = fIncome - fExpenses
  const fRunway = Math.round((DEMO.cash / (fExpenses || 1)) * 30)

  /* ── Command palette ── */
  const CMD_ACTIONS = [
    { label: 'Add Income', icon: '💰', action: () => setModal('income') },
    { label: 'Add Expense', icon: '🧮', action: () => setModal('expense') },
    { label: 'Create Invoice', icon: '🧾', action: () => setModal('invoice') },
    { label: 'Add Client', icon: '👥', action: () => setModal('client') },
    { label: 'Upload Document', icon: '📁', action: () => setModal('document') },
    { label: 'Set Budget', icon: '🎯', action: () => setModal('budget') },
    { label: 'View Cash Flow', icon: '📈', action: () => { window.location.href = '/cashflow' } },
    { label: 'View Reports', icon: '📊', action: () => { window.location.href = '/reports' } },
    { label: 'Tax Prep', icon: '📋', action: () => { window.location.href = '/tax' } },
    { label: 'Learn: Health Score', icon: '❤️', action: () => setLearnTopic('health') },
    { label: 'Learn: Cash Flow', icon: '💡', action: () => setLearnTopic('cashflow') },
  ]
  const filteredCmds = CMD_ACTIONS.filter(a => a.label.toLowerCase().includes(cmdQuery.toLowerCase()))

  useEffect(() => {
    if (!cmdOpen) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIdx(i => Math.min(i + 1, filteredCmds.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCmdIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter') { e.preventDefault(); filteredCmds[cmdIdx]?.action(); setCmdOpen(false) }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [cmdOpen, cmdIdx, filteredCmds])

  /* ── KPI cards ── */
  const KPI_CARDS = [
    { key: 'revenue', label: 'Revenue', value: DEMO.revenue, goal: 20000, prefix: '$', color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: '💰', learn: 'revenue' as LearnTopic, tip: 'Total money earned before expenses.' },
    { key: 'expenses', label: 'Expenses', value: DEMO.expenses, goal: 10000, prefix: '$', color: '#ff7043', bg: 'rgba(255,112,67,0.08)', icon: '🧮', learn: 'expenses' as LearnTopic, tip: 'Total money spent running your business.' },
    { key: 'profit', label: 'Net Profit', value: DEMO.profit, goal: 15000, prefix: '$', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', icon: '📊', learn: 'profit' as LearnTopic, tip: 'Money left after all expenses. What your business keeps.' },
    { key: 'cash', label: 'Cash Available', value: DEMO.cash, goal: 50000, prefix: '$', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', icon: '🏦', learn: 'cashflow' as LearnTopic, tip: 'Real cash in your bank account right now.' },
    { key: 'tax', label: 'Tax Reserve', value: DEMO.taxReserve, goal: 3000, prefix: '$', color: '#ec4899', bg: 'rgba(236,72,153,0.08)', icon: '🧮', learn: 'tax' as LearnTopic, tip: 'Money set aside to pay quarterly taxes. Do not spend this.' },
    { key: 'outstanding', label: 'Outstanding', value: DEMO.outstanding, goal: 5000, prefix: '$', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '⏳', learn: 'invoices' as LearnTopic, tip: 'Money clients owe you that has not been paid.' },
    { key: 'clients', label: 'Active Clients', value: DEMO.clients, goal: 10, prefix: '', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', icon: '👥', learn: 'clients' as LearnTopic, tip: 'Clients worked with in the last 90 days.' },
    { key: 'documents', label: 'Documents', value: DEMO.documents, goal: 50, prefix: '', color: '#14b8a6', bg: 'rgba(20,184,166,0.08)', icon: '📁', learn: 'docs' as LearnTopic, tip: 'Files stored in your vault. IRS requires 7 years of records.' },
  ]

  /* ── Business Insights (renamed from Smart Insights) ── */
  const INSIGHTS = [
    { icon: '⚠️', msg: 'INV-042 is 13 days overdue from Stellar Brands ($3,200)', action: 'Send Reminder', color: '#ef4444', onAction: () => toast.success('Reminder sent to Stellar Brands 📨') },
    { icon: '🚀', msg: 'Revenue up 12% vs last month — best month yet!', action: 'View Breakdown', color: '#10b981', onAction: () => setLearnTopic('revenue') },
    { icon: '📊', msg: 'Software budget is at 95% — $52 remaining', action: 'View Budget', color: '#f59e0b', onAction: () => toast('Head to the Budget page to review →', { icon: '🎯' }) },
    { icon: '🗓️', msg: 'Q2 estimated tax due Jun 15 — $535 owed', action: 'Go to Tax Center', color: '#6366f1', onAction: () => toast('Tax reserve looks good! 98% covered 🧮', { icon: '✅' }) },
    { icon: '🎯', msg: 'Profit margin hit 63% this month — above target!', action: 'View Report', color: '#0ea5e9', onAction: () => toast('Navigating to reports →', { icon: '📋' }) },
  ]

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 44, width: 320, marginBottom: 28 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {[...Array(8)].map((_, i) => <div key={i} style={{ height: 100 }} className="skeleton" />)}
        </div>
        <div style={{ height: 300 }} className="skeleton" />
      </div>
    )
  }

  const chartData = chartView === 'monthly' ? MONTHLY_DATA : QUARTERLY_DATA
  const insightBtnStyle = {
    background: 'rgba(99,102,241,0.1)', color: '#6366f1',
    border: '1.5px solid rgba(99,102,241,0.25)', borderRadius: 8,
    padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700,
    cursor: 'pointer', transition: 'all 0.15s',
  }

  return (
    <div className="page-content" id="main-content">
      {confetti && <ReactConfetti recycle={false} numberOfPieces={450} />}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* ── Header + Quick Actions ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">{greet(userName)}</h1>
            <p style={{ color: 'var(--mu)', fontSize: '0.8rem', marginTop: 4 }}>Here&apos;s your financial overview.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([
              { label: '+ Income', m: 'income', c: '#10b981' },
              { label: '+ Expense', m: 'expense', c: '#ff7043' },
              { label: '+ Invoice', m: 'invoice', c: '#6366f1' },
              { label: '+ Client', m: 'client', c: '#0ea5e9' },
              { label: '+ Document', m: 'document', c: '#8b5cf6' },
              { label: '⌘K', m: null, c: '#f59e0b' },
            ] as const).map(a => (
              <button key={a.label}
                onClick={() => a.m ? setModal(a.m as Modal) : setCmdOpen(true)}
                style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${a.c}33`, background: `${a.c}11`, color: a.c, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${a.c}22` }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${a.c}11` }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Cards (8) with ⓘ info icons ── */}
        <div className="dash-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {KPI_CARDS.map((k, i) => {
            const pct = Math.min(100, (k.value / k.goal) * 100)
            const expanded = expandedKpi === k.key
            return (
              <motion.div key={k.key} className="stat-card"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.35, ease: 'easeOut' }}
                onClick={() => setExpandedKpi(expanded ? null : k.key)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{k.icon}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <InfoIcon topic={k.learn} onLearn={setLearnTopic} tooltip={k.tip} />
                    <span style={{ fontSize: '0.6rem', color: 'var(--mu)' }}>{expanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                <div className="stat-label" style={{ fontSize: '0.7rem' }}>{k.label}</div>
                <div className="stat-value" style={{ color: k.color, fontSize: 20 }}>
                  {k.prefix}<CountUp end={k.value} decimals={k.prefix ? 2 : 0} duration={1.3} separator="," />
                </div>
                <AnimatePresence>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--mu)', marginBottom: 5 }}>
                          <span>Goal: {k.prefix}{k.goal.toLocaleString()}</span>
                          <span style={{ color: k.color, fontWeight: 800 }}>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="progress-track">
                          <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ background: k.color }} />
                        </div>
                        <button onClick={e => { e.stopPropagation(); setLearnTopic(k.learn) }}
                          style={{ marginTop: 10, fontSize: '0.7rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}>
                          Learn more →
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* ── Charts + Business Insights row ── */}
        <div className="dash-chart-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Revenue vs Expenses */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Revenue vs Expenses</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--mu)', marginTop: 2 }}>With profit line overlay</p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['monthly', 'quarterly'] as const).map(v => (
                  <button key={v} onClick={() => setChartView(v)}
                    style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.15s', background: chartView === v ? '#6366f1' : 'var(--bg3)', color: chartView === v ? '#fff' : 'var(--mu)' }}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--mu)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--mu)' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Revenue" fill="#10b981" radius={[5, 5, 0, 0]} animationBegin={200} animationDuration={700} />
                <Bar dataKey="expenses" name="Expenses" fill="#ff7043" radius={[5, 5, 0, 0]} animationBegin={300} animationDuration={700} />
                <Line dataKey="profit" name="Profit" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} type="monotone" animationBegin={400} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Business Insights (renamed, redesigned) */}
          <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Business Insights</h2>
              <div className="live-dot" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {INSIGHTS.map((ins, i) => (
                <div key={i} style={{
                  padding: '16px 14px', borderRadius: 10, background: 'var(--bg3)',
                  border: `1px solid ${ins.color}22`,
                  borderLeft: `4px solid ${ins.color}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{ins.icon}</span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--ink)', lineHeight: 1.55, fontWeight: 500 }}>{ins.msg}</p>
                  </div>
                  <button
                    onClick={ins.onAction}
                    style={{
                      ...insightBtnStyle,
                      color: ins.color,
                      background: `${ins.color}18`,
                      border: `1.5px solid ${ins.color}33`,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${ins.color}28` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${ins.color}18` }}
                  >
                    {ins.action}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Cash Flow + Can I Afford This? + Forecast ── */}
        <div className="dash-cashflow-row" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Cash Flow */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Cash Flow</h2>
                <InfoIcon topic="cashflow" onLearn={setLearnTopic} tooltip="The movement of money in and out of your business each month." />
              </div>
              <button onClick={() => setLearnTopic('cashflow')} style={{ fontSize: '0.75rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Learn →</button>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={CASHFLOW_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--mu)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--mu)' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="inflow" name="In" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} animationDuration={700} />
                <Line type="monotone" dataKey="outflow" name="Out" stroke="#ff7043" strokeWidth={2} dot={{ r: 3 }} animationDuration={700} />
                <Line type="monotone" dataKey="projected" name="Projected" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" dot={false} animationDuration={700} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Can I Afford This? (redesigned) */}
          <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h2 style={{ fontWeight: 900, fontSize: 14, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Can I Afford This?</h2>
                <InfoIcon topic="afford" onLearn={setLearnTopic} tooltip="Estimate how a purchase may affect your business cash position and runway." />
              </div>
              <button onClick={() => setLearnTopic('afford')} style={{ fontSize: '0.7rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>Learn →</button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--mu)', marginBottom: 10 }}>Current cash: <strong style={{ color: '#10b981' }}>${DEMO.cash.toLocaleString()}</strong></p>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 13 }}>$</span>
              <input type="number" min="0" value={affordAmt} onChange={e => setAffordAmt(e.target.value)} placeholder="Enter purchase amount"
                style={{ width: '100%', padding: '8px 12px', paddingLeft: 26, background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 9, fontSize: '0.8rem', color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
              {[500, 2000, 5000, 10000].map(v => (
                <button key={v} onClick={() => setAffordAmt(String(v))}
                  style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: parseFloat(affordAmt) === v ? '#6366f1' : 'var(--bg3)', color: parseFloat(affordAmt) === v ? '#fff' : 'var(--mu)' }}>
                  ${v >= 1000 ? `${v/1000}k` : v}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {affordResult && (
                <motion.div key={affordResult.risk} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                  style={{ padding: '12px 14px', borderRadius: 12, background: affordResult.resultBg, border: `1px solid ${affordResult.borderColor}` }}>
                  {/* Verdict */}
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: affordResult.verdictColor, marginBottom: 10, lineHeight: 1.4 }}>{affordResult.verdict}</p>
                  {/* Risk badge */}
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: affordResult.riskBg, color: affordResult.riskColor, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    {affordResult.risk}
                  </span>
                  {/* Breakdown rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      { label: 'Cash Available', val: `$${DEMO.cash.toLocaleString()}`, c: '#10b981' },
                      { label: 'Purchase Amount', val: `-$${amt.toLocaleString()}`, c: 'var(--ink)' },
                      { label: 'Cash Remaining', val: `$${Math.max(0, cashRemaining).toLocaleString()}`, c: affordResult.verdictColor },
                      { label: 'Runway Impact', val: `${runwayMonths.toFixed(1)} mo left`, c: affordResult.verdictColor },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                        <span style={{ color: 'var(--mu)' }}>{row.label}</span>
                        <span style={{ fontWeight: 700, color: row.c, fontFamily: `DM Mono, monospace` }}>{row.val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="progress-track" style={{ marginTop: 10 }}>
                    <motion.div className="progress-fill" animate={{ width: `${Math.min(100, (amt / DEMO.cash) * 100)}%` }} transition={{ duration: 0.4 }} style={{ background: affordResult.verdictColor }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Forecast */}
          <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Forecast</h2>
                <InfoIcon topic="forecast" onLearn={setLearnTopic} tooltip="Estimated future finances based on current trends." />
              </div>
              <button onClick={() => setLearnTopic('forecast')} style={{ fontSize: '0.75rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Learn →</button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--mu)', marginBottom: 14 }}>30/60/90 day projections</p>
            <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
              {(['expected', 'best', 'worst'] as const).map(s => (
                <button key={s} onClick={() => setScenario(s)}
                  style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.15s',
                    background: scenario === s ? (s === 'best' ? '#10b981' : s === 'worst' ? '#ef4444' : '#6366f1') : 'var(--bg3)',
                    color: scenario === s ? '#fff' : 'var(--mu)' }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={scenario} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}>
                {[
                  { label: 'Proj. Revenue', v: fIncome, c: '#10b981' },
                  { label: 'Proj. Expenses', v: fExpenses, c: '#ff7043' },
                  { label: 'Proj. Profit', v: fProfit, c: fProfit >= 0 ? '#6366f1' : '#ef4444' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--mu)' }}>{r.label}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: r.c, fontFamily: `DM Mono, monospace` }}>${r.v.toFixed(0)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10, textAlign: 'center' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--mu)', marginBottom: 2 }}>Business Runway</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: fRunway > 90 ? '#10b981' : fRunway > 30 ? '#f59e0b' : '#ef4444', letterSpacing: '-0.03em' }}>{fRunway} days</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Goals + Health + Checklist row ── */}
        <div className="dash-goals-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Monthly Goals */}
          <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.4 }}>
            <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Monthly Goals</h2>
            {GOALS.map((g, i) => {
              const pct = Math.min(100, (g.current / g.target) * 100)
              return (
                <div key={g.label} style={{ marginBottom: i < GOALS.length - 1 ? 16 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 5 }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{g.label}</span>
                    <span style={{ color: g.color, fontWeight: 800 }}>{g.prefix}{g.current.toLocaleString()} / {g.prefix}{g.target.toLocaleString()}</span>
                  </div>
                  <div className="progress-track">
                    <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 * i }} style={{ background: g.color }} />
                  </div>
                </div>
              )
            })}
          </motion.div>

          {/* Business Health Score */}
          <motion.div className="glass-card" style={{ padding: 20, textAlign: 'center' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Health Score</h2>
              <InfoIcon topic="health" onLearn={setLearnTopic} tooltip="A 0-100 score measuring financial health across 7 factors." />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--mu)', marginBottom: 20 }}>Based on your real data</p>
            <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto 16px' }}>
              <svg viewBox="0 0 110 110" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="55" cy="55" r="46" fill="none" stroke="var(--bg3)" strokeWidth="10" />
                <motion.circle cx="55" cy="55" r="46" fill="none"
                  stroke="url(#healthGrad)" strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 46}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 46 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 46 * (1 - 82 / 100) }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                  strokeLinecap="round" />
                <defs>
                  <linearGradient id="healthGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: '#10b981', letterSpacing: '-0.04em', lineHeight: 1 }}>
                  <CountUp end={82} duration={1.5} />
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--mu)' }}>/100</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[{ label: 'Collection Rate', val: '92%', c: '#10b981' }, { label: 'Expense Ratio', val: '37%', c: '#6366f1' }, { label: 'Client Diversity', val: 'Good', c: '#0ea5e9' }].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--mu)' }}>{r.label}</span>
                  <span style={{ color: r.c, fontWeight: 700 }}>{r.val}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setLearnTopic('health')} style={{ marginTop: 14, fontSize: '0.75rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              Learn more →
            </button>
          </motion.div>

          {/* Setup Checklist */}
          <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Setup</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--mu)' }}>{checklist.filter(Boolean).length}/{CHECKLIST_ITEMS.length}</span>
            </div>
            <div className="progress-track" style={{ marginBottom: 14 }}>
              <div className="progress-fill" style={{ width: `${(checklist.filter(Boolean).length / CHECKLIST_ITEMS.length) * 100}%`, background: 'var(--primary)', transition: 'width 0.5s ease' }} />
            </div>
            {CHECKLIST_ITEMS.map((item, i) => (
              <button key={i} onClick={() => tick(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', textAlign: 'left' }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: checklist[i] ? 'none' : '1.5px solid var(--bd2)', background: checklist[i] ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                  {checklist[i] && <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: '0.8rem', color: checklist[i] ? 'var(--mu)' : 'var(--ink)', textDecoration: checklist[i] ? 'line-through' : 'none', transition: 'all 0.2s' }}>{item}</span>
              </button>
            ))}
          </motion.div>
        </div>

        {/* ── Connected Apps ── */}
        <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.4 }}>
          <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Connected Apps</h2>
          <div className="dash-apps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
            {CONNECTED_APPS.map(app => (
              <button key={app.name} onClick={() => {
                if (app.status === 'connected') toast.success(`${app.name} connected ✓`, { icon: '✅' })
                else if (app.status === 'connect') toast(`Connect ${app.name} in Settings → Integrations`, { icon: '🔗' })
                else toast(`${app.name} integration coming soon! 🚀`, { icon: '⏳' })
              }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px', borderRadius: 12, border: `1px solid ${app.status === 'connected' ? '#10b981' : 'var(--bd)'}`, background: app.status === 'connected' ? 'rgba(16,185,129,0.06)' : 'var(--bg3)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}>
                <span style={{ fontSize: 22 }}>{app.icon}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--ink)' }}>{app.name}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: app.status === 'connected' ? '#10b981' : app.status === 'connect' ? '#6366f1' : 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {app.status === 'connected' ? '● Connected' : app.status === 'connect' ? 'Connect' : 'Soon'}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* ══ Modals ══ */}
      <AnimatePresence>
        {modal === 'income' && <IncomeModal userId={userId} clients={clients} onClose={() => setModal(null)} />}
        {modal === 'expense' && <ExpenseModal userId={userId} onClose={() => setModal(null)} />}
        {modal === 'invoice' && <InvoiceModal userId={userId} clients={clients} onClose={() => setModal(null)} />}
        {modal === 'client' && <ClientModal userId={userId} onClose={() => setModal(null)} onSuccess={() => { const sb = createClient(); sb.from('clients').select('id,name,email,payment_terms,address,company').eq('user_id', userId).then(({ data }) => { if (data) setClients(data as ModalClient[]) }) }} />}
        {modal === 'document' && <DocumentModal userId={userId} onClose={() => setModal(null)} />}
        {modal === 'budget' && <BudgetModal userId={userId} onClose={() => setModal(null)} />}
      </AnimatePresence>

      {/* ══ Command Palette ══ */}
      <AnimatePresence>
        {cmdOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCmdOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 900 }} />
            <motion.div initial={{ opacity: 0, scale: 0.94, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              role="dialog" aria-modal="true" aria-label="Command palette"
              style={{ position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 560, zIndex: 901, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
                <span style={{ color: 'var(--mu2)', fontSize: 16 }}>🔍</span>
                <input autoFocus value={cmdQuery} onChange={e => { setCmdQuery(e.target.value); setCmdIdx(0) }} placeholder="Search actions..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--ink)', fontFamily: 'inherit' }} />
                <kbd style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 5, background: 'var(--bg3)', color: 'var(--mu)', border: '1px solid var(--bd2)' }}>ESC</kbd>
              </div>
              <div style={{ padding: 8, maxHeight: 380, overflowY: 'auto' }}>
                {filteredCmds.length === 0 && <p style={{ textAlign: 'center', padding: 24, color: 'var(--mu)', fontSize: '0.8rem' }}>No results</p>}
                {filteredCmds.map((a, i) => (
                  <button key={a.label} onClick={() => { a.action(); setCmdOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--ink)', background: i === cmdIdx ? 'rgba(99,102,241,0.1)' : 'transparent', transition: 'background 0.12s', textAlign: 'left' }}
                    onMouseEnter={() => setCmdIdx(i)}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{a.icon}</div>
                    <span style={{ fontWeight: 500 }}>{a.label}</span>
                    {i === cmdIdx && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--mu)' }}>↵ select</span>}
                  </button>
                ))}
              </div>
              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 16, fontSize: '0.65rem', color: 'var(--mu2)' }}>
                <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
                <span style={{ marginLeft: 'auto' }}>⌘K to open</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ Learn Panel ══ */}
      <AnimatePresence>
        {learnTopic && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setLearnTopic(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 799 }} />
            <LearnPanel topic={learnTopic} onClose={() => setLearnTopic(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
