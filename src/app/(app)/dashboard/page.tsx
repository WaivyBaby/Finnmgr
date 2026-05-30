'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import CountUp from 'react-countup'
import { motion, AnimatePresence } from 'framer-motion'
import ReactConfetti from 'react-confetti'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import toast from 'react-hot-toast'

/* ── Static demo data ─────────────────────────────────────────────────────── */
const DEMO = {
  revenue: 18450, expenses: 6820, profit: 11630,
  cash: 34200, taxReserve: 2140, outstanding: 8750,
  clients: 7, documents: 24,
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
  revenue: { title: 'Revenue', def: 'Total income earned from all business activities before any deductions.', example: '$18,450 revenue in June means you invoiced and collected that amount from clients this month.', tips: ['Track monthly to spot seasonal trends', 'Set a 10% month-over-month growth target', 'Identify your highest-margin service'] },
  cashflow: { title: 'Cash Flow', def: 'The net movement of money in and out of your business over a period of time.', example: 'If you received $18,450 but paid $10,100 in expenses, your net cash flow is +$8,350.', tips: ['Keep 3 months of expenses as a cash reserve', 'Invoice on completion, not end of month', 'Use 30-day payment terms at most'] },
  profit: { title: 'Net Profit', def: 'Revenue minus all operating expenses. What you actually keep after costs.', example: '$18,450 revenue − $6,820 expenses = $11,630 net profit (63% margin).', tips: ['Aim for 40%+ profit margin for services', 'Review expenses quarterly for cuts', 'Reinvest 20% into growth activities'] },
  invoices: { title: 'Outstanding Invoices', def: 'Money owed to you by clients that has been invoiced but not yet paid.', example: '$8,750 outstanding means clients owe you that amount across unpaid invoices.', tips: ['Send reminders at 7, 14, and 30 days', 'Offer 2% discount for early payment', 'Require 50% deposit on new projects'] },
  tax: { title: 'Tax Reserve', def: 'Money set aside to pay estimated quarterly taxes. Typically 25–30% of net profit.', example: 'With $11,630 profit, you should set aside ~$2,900 (25%) for taxes. You have $2,140 saved.', tips: ['Set aside 25-30% of every payment received', 'Pay quarterly to avoid IRS penalties', 'Track deductible expenses to reduce taxable income'] },
  clients: { title: 'Active Clients', def: 'Clients with at least one invoice or transaction in the last 90 days.', example: '7 active clients at $18,450 revenue = $2,636 average revenue per client.', tips: ['Aim for 10+ clients to reduce concentration risk', 'Identify your top 3 and upsell them', 'Reconnect with dormant clients quarterly'] },
  docs: { title: 'Document Vault', def: 'Secure storage for contracts, receipts, tax docs, and business records.', example: '24 documents stored includes 6 invoices, 8 receipts, 4 contracts, and 6 tax documents.', tips: ['Upload receipts same day as purchase', 'Store signed contracts immediately', 'Organize by year and category'] },
  expenses: { title: 'Expenses', def: 'All costs incurred to operate your business, both fixed and variable.', example: '$6,820 in expenses this month across software, marketing, and operations.', tips: ['Review subscriptions monthly — cancel unused ones', 'Categorize everything for tax deductions', 'Keep personal and business expenses separate'] },
  afford: { title: 'Affordability Calculator', def: 'Shows whether a purchase is advisable based on your current cash position and recommended reserves.', example: 'With $34,200 cash, spending $5,000 (15%) is green. Spending $25,000 (73%) is red.', tips: ['Keep 3 months expenses in reserve (~$20,000)', 'Green = under 30% of cash', 'Amber = 30–70%, Red = over 70%'] },
  forecast: { title: 'Forecast Scenarios', def: 'Projected financial outcomes based on optimistic, expected, or pessimistic growth assumptions.', example: 'Best case assumes 20% revenue growth and 10% expense reduction. Worst case is the inverse.', tips: ['Plan for worst case — it forces smart reserves', 'Use best case for stretch goals only', 'Re-forecast every quarter with real data'] },
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

/* ── Reusable tooltip ─────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 11 }}>
      <p style={{ fontWeight: 800, marginBottom: 6, color: 'var(--ink)' }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>{p.name}: ${Number(p.value).toLocaleString()}</p>)}
    </div>
  )
}

/* ── Modal shell ─────────────────────────────────────────────────────────── */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div initial={{ opacity: 0, scale: 0.93, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 20, width: '100%', maxWidth: 460, boxShadow: '0 30px 90px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--bd)' }}>
          <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </motion.div>
    </motion.div>
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
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1', marginBottom: 8 }}>Definition</p>
          <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>{content.def}</p>
        </div>
        <div style={{ marginBottom: 20, padding: '14px 16px', background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.15)' }}>
          <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1', marginBottom: 8 }}>Example</p>
          <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>{content.example}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1', marginBottom: 10 }}>Tips</p>
          {content.tips.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#fff', fontWeight: 800 }}>{i + 1}</div>
              <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{t}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ── Field helper ────────────────────────────────────────────────────────── */
const iStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu)' }}>{label}</label>
      {children}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('there')
  const [loading, setLoading] = useState(true)

  // UI state
  const [modal, setModal] = useState<Modal>(null)
  const [learnTopic, setLearnTopic] = useState<LearnTopic>(null)
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null)
  const [chartView, setChartView] = useState<ChartView>('monthly')
  const [scenario, setScenario] = useState<Scenario>('expected')
  const [affordAmt, setAffordAmt] = useState('')
  const [confetti, setConfetti] = useState(false)
  const [checklist, setChecklist] = useState<boolean[]>(Array(7).fill(false))
  const [saving, setSaving] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')
  const [cmdIdx, setCmdIdx] = useState(0)

  // Form state
  const [incF, setIncF] = useState({ client_name: '', amount: '', category: 'Design', date: '' })
  const [expF, setExpF] = useState({ vendor: '', amount: '', category: 'Operations', date: '' })
  const [invF, setInvF] = useState({ client_name: '', client_email: '', amount: '', due_date: '' })
  const [cliF, setCliF] = useState({ name: '', email: '', company: '' })
  const [docF, setDocF] = useState({ name: '', category: 'Contracts' })
  const [budF, setBudF] = useState({ name: '', monthly_limit: '', icon: '💼' })

  /* Load user */
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setIncF(f => ({ ...f, date: today }))
    setExpF(f => ({ ...f, date: today }))
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      setUserName(user.user_metadata?.full_name?.split(' ')[0] ?? 'there')
    }).finally(() => setLoading(false))
    // Load checklist
    try { const s = localStorage.getItem(CHECKLIST_KEY); if (s) setChecklist(JSON.parse(s)) } catch {}
  }, [])

  /* Cmd+K */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); setCmdQuery(''); setCmdIdx(0) }
      if (e.key === 'Escape') { setCmdOpen(false); setLearnTopic(null) }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  /* Greeting */
  function greet(name: string) {
    const h = new Date().getHours()
    if (h < 12) return `Good morning, ${name} ☀️`
    if (h < 17) return `Good afternoon, ${name} 👋`
    if (h < 21) return `Good evening, ${name} 🌆`
    return `You're up late, ${name} 🌙`
  }

  /* Checklist */
  function tick(i: number) {
    const n = [...checklist]; n[i] = !n[i]; setChecklist(n)
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(n)) } catch {}
    if (n.every(Boolean)) { setConfetti(true); toast.success("Setup complete! You're officially in business 🎉"); setTimeout(() => setConfetti(false), 6000) }
  }

  /* Affordability */
  const amt = parseFloat(affordAmt) || 0
  const cashLeft = DEMO.cash - amt
  const afford = amt === 0 ? null
    : cashLeft >= 8000 ? { label: 'Yes, you can afford this ✓', color: '#10b981', bg: 'rgba(16,185,129,0.1)' }
    : cashLeft >= 2000 ? { label: 'Possible but tight ⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    : { label: 'Not recommended right now ✗', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }

  /* Forecast */
  const sm = scenario === 'best' ? 1.2 : scenario === 'worst' ? 0.8 : 1
  const em = scenario === 'best' ? 0.9 : scenario === 'worst' ? 1.15 : 1
  const fIncome = DEMO.revenue * sm
  const fExpenses = DEMO.expenses * em
  const fProfit = fIncome - fExpenses
  const fRunway = Math.round((DEMO.cash / (fExpenses || 1)) * 30)

  /* Command palette actions */
  const CMD_ACTIONS = [
    { label: 'Add Income', icon: '💰', action: () => setModal('income') },
    { label: 'Add Expense', icon: '🧮', action: () => setModal('expense') },
    { label: 'Create Invoice', icon: '🧾', action: () => setModal('invoice') },
    { label: 'Add Client', icon: '👥', action: () => setModal('client') },
    { label: 'Upload Document', icon: '📁', action: () => setModal('document') },
    { label: 'Set Budget', icon: '🎯', action: () => setModal('budget') },
    { label: 'View Cash Flow', icon: '📈', action: () => window.location.href = '/cashflow' },
    { label: 'View Reports', icon: '📊', action: () => window.location.href = '/reports' },
    { label: 'Tax Prep', icon: '📋', action: () => window.location.href = '/tax' },
    { label: 'Learn: Health Score', icon: '❤️', action: () => setLearnTopic('health') },
    { label: 'Learn: Cash Flow', icon: '💡', action: () => setLearnTopic('cashflow') },
  ]
  const filteredCmds = CMD_ACTIONS.filter(a => a.label.toLowerCase().includes(cmdQuery.toLowerCase()))

  /* Cmd keyboard nav */
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

  /* Save helpers */
  async function saveIncome(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('income').insert({ user_id: userId, ...incF, amount: parseFloat(incF.amount) })
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    toast.success('Income added ✓'); setModal(null)
    setIncF({ client_name: '', amount: '', category: 'Design', date: new Date().toISOString().split('T')[0] })
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('expenses').insert({ user_id: userId, ...expF, amount: parseFloat(expF.amount) })
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    toast.success('Expense added ✓'); setModal(null)
    setExpF({ vendor: '', amount: '', category: 'Operations', date: new Date().toISOString().split('T')[0] })
  }

  async function saveInvoice(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const total = parseFloat(invF.amount)
    const num = `INV-${Date.now().toString().slice(-6)}`
    const { error } = await sb.from('invoices').insert({ user_id: userId, invoice_number: num, client_name: invF.client_name, client_email: invF.client_email, due_date: invF.due_date, total, balance_due: total, line_items: [{ description: 'Services', quantity: 1, rate: total, amount: total }] })
    setSaving(false)
    if (error) { toast.error('Failed to create invoice'); return }
    toast.success('Invoice created! 🧾'); setModal(null)
  }

  async function saveClient(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('clients').insert({ user_id: userId, ...cliF })
    setSaving(false)
    if (error) { toast.error('Failed to add client'); return }
    toast.success('Client added ✓'); setModal(null)
  }

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('budget_categories').insert({ user_id: userId, name: budF.name, icon: budF.icon, monthly_limit: parseFloat(budF.monthly_limit), sort_order: 0 })
    setSaving(false)
    if (error) { toast.error('Failed to save budget'); return }
    toast.success('Budget category added ✓'); setModal(null)
  }

  /* KPI cards */
  const KPI_CARDS = [
    { key: 'revenue', label: 'Revenue', value: DEMO.revenue, goal: 20000, prefix: '$', color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: '💰', learn: 'revenue' as LearnTopic },
    { key: 'expenses', label: 'Expenses', value: DEMO.expenses, goal: 10000, prefix: '$', color: '#ff7043', bg: 'rgba(255,112,67,0.08)', icon: '🧮', learn: 'expenses' as LearnTopic },
    { key: 'profit', label: 'Net Profit', value: DEMO.profit, goal: 15000, prefix: '$', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', icon: '📊', learn: 'profit' as LearnTopic },
    { key: 'cash', label: 'Cash Available', value: DEMO.cash, goal: 50000, prefix: '$', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', icon: '🏦', learn: 'cashflow' as LearnTopic },
    { key: 'tax', label: 'Tax Reserve', value: DEMO.taxReserve, goal: 3000, prefix: '$', color: '#ec4899', bg: 'rgba(236,72,153,0.08)', icon: '🧮', learn: 'tax' as LearnTopic },
    { key: 'outstanding', label: 'Outstanding', value: DEMO.outstanding, goal: 5000, prefix: '$', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '⏳', learn: 'invoices' as LearnTopic },
    { key: 'clients', label: 'Active Clients', value: DEMO.clients, goal: 10, prefix: '', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', icon: '👥', learn: 'clients' as LearnTopic },
    { key: 'documents', label: 'Documents', value: DEMO.documents, goal: 50, prefix: '', color: '#14b8a6', bg: 'rgba(20,184,166,0.08)', icon: '📁', learn: 'docs' as LearnTopic },
  ]

  /* Smart insights */
  const INSIGHTS = [
    { icon: '⚠️', msg: 'INV-042 is 13 days overdue from Stellar Brands ($3,200)', action: 'Send reminder', color: '#ef4444', onAction: () => toast.success('Reminder sent to Stellar Brands 📨') },
    { icon: '🚀', msg: 'Revenue up 12% vs last month — best month yet!', action: 'Learn why', color: '#10b981', onAction: () => setLearnTopic('revenue') },
    { icon: '📊', msg: 'Software budget is at 95% — $52 remaining', action: 'View budget', color: '#f59e0b', onAction: () => toast('Head to the Budget page to review →', { icon: '🎯' }) },
    { icon: '🗓️', msg: 'Q2 estimated tax due Jun 15 — $535 owed', action: 'View tax', color: '#6366f1', onAction: () => toast('Tax reserve looks good! 98% covered 🧮', { icon: '✅' }) },
    { icon: '🎯', msg: 'Profit margin hit 63% this month — above target!', action: 'See report', color: '#0ea5e9', onAction: () => toast('Navigating to reports →', { icon: '📋' }) },
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

  return (
    <div className="page-content" id="main-content">
      {confetti && <ReactConfetti recycle={false} numberOfPieces={450} />}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* ── Header + Quick Actions ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">{greet(userName)}</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Here&apos;s your financial overview.</p>
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
                style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${a.c}33`, background: `${a.c}11`, color: a.c, fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${a.c}22` }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${a.c}11` }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Cards (8) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {KPI_CARDS.map((k, i) => {
            const pct = Math.min(100, (k.value / k.goal) * 100)
            const expanded = expandedKpi === k.key
            return (
              <motion.div key={k.key} className="stat-card"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.35, ease: 'easeOut' }}
                onClick={() => setExpandedKpi(expanded ? null : k.key)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>{k.icon}</div>
                  <span style={{ fontSize: 9, color: 'var(--mu)' }}>{expanded ? '▲' : '▼'}</span>
                </div>
                <div className="stat-label">{k.label}</div>
                <div className="stat-value" style={{ color: k.color, fontSize: 20 }}>
                  {k.prefix}<CountUp end={k.value} decimals={k.prefix ? 2 : 0} duration={1.3} separator="," />
                </div>
                <AnimatePresence>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--mu)', marginBottom: 5 }}>
                          <span>Goal: {k.prefix}{k.goal.toLocaleString()}</span>
                          <span style={{ color: k.color, fontWeight: 800 }}>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="progress-track">
                          <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ background: k.color }} />
                        </div>
                        <button onClick={e => { e.stopPropagation(); setLearnTopic(k.learn) }}
                          style={{ marginTop: 10, fontSize: 10, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}>
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

        {/* ── Charts + Insights row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Revenue vs Expenses */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Revenue vs Expenses</h2>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>With profit line overlay</p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['monthly', 'quarterly'] as const).map(v => (
                  <button key={v} onClick={() => setChartView(v)}
                    style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s', background: chartView === v ? '#6366f1' : 'var(--bg3)', color: chartView === v ? '#fff' : 'var(--mu)' }}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="Revenue" fill="#10b981" radius={[5, 5, 0, 0]} animationBegin={200} animationDuration={700} />
                <Bar dataKey="expenses" name="Expenses" fill="#ff7043" radius={[5, 5, 0, 0]} animationBegin={300} animationDuration={700} />
                <Line dataKey="profit" name="Profit" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} type="monotone" animationBegin={400} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Smart Insights */}
          <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Smart Insights</h2>
              <div className="live-dot" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {INSIGHTS.map((ins, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', border: `1px solid ${ins.color}22` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{ins.icon}</span>
                    <p style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.5 }}>{ins.msg}</p>
                  </div>
                  <button onClick={ins.onAction}
                    style={{ fontSize: 10, fontWeight: 800, color: ins.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.03em' }}>
                    {ins.action} →
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Cash Flow + Affordability + Forecast ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Cash Flow */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Cash Flow</h2>
              <button onClick={() => setLearnTopic('cashflow')} style={{ fontSize: 10, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Learn →</button>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={CASHFLOW_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="inflow" name="In" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} animationDuration={700} />
                <Line type="monotone" dataKey="outflow" name="Out" stroke="#ff7043" strokeWidth={2} dot={{ r: 3 }} animationDuration={700} />
                <Line type="monotone" dataKey="projected" name="Projected" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" dot={false} animationDuration={700} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Affordability */}
          <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Affordability</h2>
              <button onClick={() => setLearnTopic('afford')} style={{ fontSize: 10, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Learn →</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 14 }}>Cash: ${DEMO.cash.toLocaleString()}</p>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 14 }}>$</span>
              <input type="number" min="0" value={affordAmt} onChange={e => setAffordAmt(e.target.value)} placeholder="Enter amount"
                style={{ ...iStyle, paddingLeft: 28, marginTop: 0 }} />
            </div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
              {[500, 2000, 5000, 10000].map(v => (
                <button key={v} onClick={() => setAffordAmt(String(v))}
                  style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer', background: parseFloat(affordAmt) === v ? '#6366f1' : 'var(--bg3)', color: parseFloat(affordAmt) === v ? '#fff' : 'var(--mu)' }}>
                  ${v >= 1000 ? `${v/1000}k` : v}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {afford && (
                <motion.div key={afford.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                  style={{ padding: '10px 14px', borderRadius: 10, background: afford.bg, color: afford.color, fontSize: 12, fontWeight: 700 }}>
                  {afford.label}
                  <p style={{ fontSize: 10, fontWeight: 400, marginTop: 4 }}>Cash left: ${cashLeft.toLocaleString()}</p>
                  <div className="progress-track" style={{ marginTop: 8 }}>
                    <motion.div className="progress-fill" animate={{ width: `${Math.min(100, (amt / DEMO.cash) * 100)}%` }} transition={{ duration: 0.4 }} style={{ background: afford.color }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Forecast */}
          <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Forecast</h2>
              <button onClick={() => setLearnTopic('forecast')} style={{ fontSize: 10, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Learn →</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 14 }}>30/60/90 day projections</p>
            <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
              {(['expected', 'best', 'worst'] as const).map(s => (
                <button key={s} onClick={() => setScenario(s)}
                  style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, transition: 'all 0.15s',
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
                    <span style={{ fontSize: 11, color: 'var(--mu)' }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: r.c, fontFamily: 'DM Mono, monospace' }}>${r.v.toFixed(0)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 2 }}>Business Runway</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: fRunway > 90 ? '#10b981' : fRunway > 30 ? '#f59e0b' : '#ef4444', letterSpacing: '-0.03em' }}>{fRunway} days</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Goals + Health + Checklist row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Monthly Goals */}
          <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.4 }}>
            <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Monthly Goals</h2>
            {GOALS.map((g, i) => {
              const pct = Math.min(100, (g.current / g.target) * 100)
              return (
                <div key={g.label} style={{ marginBottom: i < GOALS.length - 1 ? 14 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
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
            <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 4 }}>Health Score</h2>
            <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 20 }}>Based on your real data</p>
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
                <span style={{ fontSize: 10, color: 'var(--mu)' }}>/100</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[{ label: 'Collection Rate', val: '92%', c: '#10b981' }, { label: 'Expense Ratio', val: '37%', c: '#6366f1' }, { label: 'Client Diversity', val: 'Good', c: '#0ea5e9' }].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--mu)' }}>{r.label}</span>
                  <span style={{ color: r.c, fontWeight: 700 }}>{r.val}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setLearnTopic('health')} style={{ marginTop: 12, fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              Learn more →
            </button>
          </motion.div>

          {/* Setup Checklist */}
          <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Setup</h2>
              <span style={{ fontSize: 11, color: 'var(--mu)' }}>{checklist.filter(Boolean).length}/{CHECKLIST_ITEMS.length}</span>
            </div>
            <div className="progress-track" style={{ marginBottom: 14 }}>
              <div className="progress-fill" style={{ width: `${(checklist.filter(Boolean).length / CHECKLIST_ITEMS.length) * 100}%`, background: 'var(--primary)', transition: 'width 0.5s ease' }} />
            </div>
            {CHECKLIST_ITEMS.map((item, i) => (
              <button key={i} onClick={() => tick(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 0', textAlign: 'left' }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: checklist[i] ? 'none' : '1.5px solid var(--bd2)', background: checklist[i] ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                  {checklist[i] && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12, color: checklist[i] ? 'var(--mu)' : 'var(--ink)', textDecoration: checklist[i] ? 'line-through' : 'none', transition: 'all 0.2s' }}>{item}</span>
              </button>
            ))}
          </motion.div>
        </div>

        {/* ── Connected Apps ── */}
        <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.4 }}>
          <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Connected Apps</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
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
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>{app.name}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: app.status === 'connected' ? '#10b981' : app.status === 'connect' ? '#6366f1' : 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {app.status === 'connected' ? '● Connected' : app.status === 'connect' ? 'Connect' : 'Soon'}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* ══ Modals ══ */}
      <AnimatePresence>
        {modal === 'income' && (
          <ModalShell title="Add Income" onClose={() => setModal(null)}>
            <form onSubmit={saveIncome}>
              <Field label="Client / Source"><input style={iStyle} required placeholder="Acme Corp" value={incF.client_name} onChange={e => setIncF(f => ({ ...f, client_name: e.target.value }))} /></Field>
              <Field label="Amount ($)"><input style={iStyle} type="number" min="0" step="0.01" required placeholder="0.00" value={incF.amount} onChange={e => setIncF(f => ({ ...f, amount: e.target.value }))} /></Field>
              <Field label="Category">
                <select style={iStyle} value={incF.category} onChange={e => setIncF(f => ({ ...f, category: e.target.value }))}>
                  {['Design','Development','Consulting','Retainer','Coaching','Writing','Marketing','Other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Date"><input style={iStyle} type="date" required value={incF.date} onChange={e => setIncF(f => ({ ...f, date: e.target.value }))} /></Field>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>{saving ? 'Saving...' : 'Add Income 💰'}</button>
                <button type="button" className="btn-ghost" onClick={() => setModal(null)} style={{ padding: '12px 20px' }}>Cancel</button>
              </div>
            </form>
          </ModalShell>
        )}
        {modal === 'expense' && (
          <ModalShell title="Add Expense" onClose={() => setModal(null)}>
            <form onSubmit={saveExpense}>
              <Field label="Vendor"><input style={iStyle} required placeholder="Adobe, AWS, etc." value={expF.vendor} onChange={e => setExpF(f => ({ ...f, vendor: e.target.value }))} /></Field>
              <Field label="Amount ($)"><input style={iStyle} type="number" min="0" step="0.01" required placeholder="0.00" value={expF.amount} onChange={e => setExpF(f => ({ ...f, amount: e.target.value }))} /></Field>
              <Field label="Category">
                <select style={iStyle} value={expF.category} onChange={e => setExpF(f => ({ ...f, category: e.target.value }))}>
                  {['Operations','Software','Marketing','Payroll','Travel','Meals','Equipment','Professional Services','Other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Date"><input style={iStyle} type="date" required value={expF.date} onChange={e => setExpF(f => ({ ...f, date: e.target.value }))} /></Field>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12, background: 'linear-gradient(135deg, #ff7043, #f59e0b)' }}>{saving ? 'Saving...' : 'Add Expense 🧮'}</button>
                <button type="button" className="btn-ghost" onClick={() => setModal(null)} style={{ padding: '12px 20px' }}>Cancel</button>
              </div>
            </form>
          </ModalShell>
        )}
        {modal === 'invoice' && (
          <ModalShell title="Create Invoice" onClose={() => setModal(null)}>
            <form onSubmit={saveInvoice}>
              <Field label="Client Name"><input style={iStyle} required placeholder="Acme Corp" value={invF.client_name} onChange={e => setInvF(f => ({ ...f, client_name: e.target.value }))} /></Field>
              <Field label="Client Email"><input style={iStyle} type="email" placeholder="client@example.com" value={invF.client_email} onChange={e => setInvF(f => ({ ...f, client_email: e.target.value }))} /></Field>
              <Field label="Amount ($)"><input style={iStyle} type="number" min="0" step="0.01" required placeholder="0.00" value={invF.amount} onChange={e => setInvF(f => ({ ...f, amount: e.target.value }))} /></Field>
              <Field label="Due Date"><input style={iStyle} type="date" required value={invF.due_date} onChange={e => setInvF(f => ({ ...f, due_date: e.target.value }))} /></Field>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>{saving ? 'Creating...' : 'Create Invoice 🧾'}</button>
                <button type="button" className="btn-ghost" onClick={() => setModal(null)} style={{ padding: '12px 20px' }}>Cancel</button>
              </div>
            </form>
          </ModalShell>
        )}
        {modal === 'client' && (
          <ModalShell title="Add Client" onClose={() => setModal(null)}>
            <form onSubmit={saveClient}>
              <Field label="Full Name"><input style={iStyle} required placeholder="Jane Smith" value={cliF.name} onChange={e => setCliF(f => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="Company"><input style={iStyle} placeholder="Acme Corp" value={cliF.company} onChange={e => setCliF(f => ({ ...f, company: e.target.value }))} /></Field>
              <Field label="Email"><input style={iStyle} type="email" placeholder="jane@example.com" value={cliF.email} onChange={e => setCliF(f => ({ ...f, email: e.target.value }))} /></Field>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>{saving ? 'Adding...' : 'Add Client 👥'}</button>
                <button type="button" className="btn-ghost" onClick={() => setModal(null)} style={{ padding: '12px 20px' }}>Cancel</button>
              </div>
            </form>
          </ModalShell>
        )}
        {modal === 'document' && (
          <ModalShell title="Upload Document" onClose={() => setModal(null)}>
            <Field label="Document Name"><input style={iStyle} required placeholder="Q2 Contract.pdf" value={docF.name} onChange={e => setDocF(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Category">
              <select style={iStyle} value={docF.category} onChange={e => setDocF(f => ({ ...f, category: e.target.value }))}>
                {['Contracts','Invoices','Tax Docs','Bank Statements','Receipts','Reports','Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <div style={{ border: '2px dashed var(--bd2)', borderRadius: 12, padding: '24px', textAlign: 'center', marginBottom: 16, cursor: 'pointer', background: 'var(--bg3)' }}
              onClick={() => toast('Head to Document Vault for full upload 📁')}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>📁</p>
              <p style={{ fontSize: 12, color: 'var(--mu)' }}>Click to select file or drag & drop</p>
              <p style={{ fontSize: 10, color: 'var(--mu2)', marginTop: 4 }}>Full upload available in Document Vault</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }} onClick={() => { toast.success('Go to Document Vault for full upload!'); setModal(null) }}>Go to Vault 📁</button>
              <button className="btn-ghost" onClick={() => setModal(null)} style={{ padding: '12px 20px' }}>Cancel</button>
            </div>
          </ModalShell>
        )}
        {modal === 'budget' && (
          <ModalShell title="Add Budget Category" onClose={() => setModal(null)}>
            <form onSubmit={saveBudget}>
              <Field label="Category Name"><input style={iStyle} required placeholder="Software subscriptions" value={budF.name} onChange={e => setBudF(f => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="Monthly Limit ($)"><input style={iStyle} type="number" min="0" step="0.01" required placeholder="500.00" value={budF.monthly_limit} onChange={e => setBudF(f => ({ ...f, monthly_limit: e.target.value }))} /></Field>
              <Field label="Icon">
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {['💼','💻','📱','✈️','🍽️','🏥','📚','🎯','🛒','⚡'].map(ic => (
                    <button key={ic} type="button" onClick={() => setBudF(f => ({ ...f, icon: ic }))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: budF.icon === ic ? '2px solid #6366f1' : '1px solid var(--bd2)', background: budF.icon === ic ? 'rgba(99,102,241,0.1)' : 'var(--bg3)', cursor: 'pointer', fontSize: 18 }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </Field>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>{saving ? 'Saving...' : 'Add Category 🎯'}</button>
                <button type="button" className="btn-ghost" onClick={() => setModal(null)} style={{ padding: '12px 20px' }}>Cancel</button>
              </div>
            </form>
          </ModalShell>
        )}
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
              style={{ position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 560, zIndex: 901, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
                <span style={{ color: 'var(--mu2)', fontSize: 16 }}>🔍</span>
                <input autoFocus value={cmdQuery} onChange={e => { setCmdQuery(e.target.value); setCmdIdx(0) }} placeholder="Search actions..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--ink)', fontFamily: 'inherit' }} />
                <kbd style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--bg3)', color: 'var(--mu)', border: '1px solid var(--bd2)' }}>ESC</kbd>
              </div>
              <div style={{ padding: 8, maxHeight: 380, overflowY: 'auto' }}>
                {filteredCmds.length === 0 && (
                  <p style={{ textAlign: 'center', padding: 24, color: 'var(--mu)', fontSize: 13 }}>No results</p>
                )}
                {filteredCmds.map((a, i) => (
                  <button key={a.label} onClick={() => { a.action(); setCmdOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink)', background: i === cmdIdx ? 'rgba(99,102,241,0.1)' : 'transparent', transition: 'background 0.12s', textAlign: 'left' }}
                    onMouseEnter={() => setCmdIdx(i)}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{a.icon}</div>
                    <span style={{ fontWeight: 500 }}>{a.label}</span>
                    {i === cmdIdx && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--mu)' }}>↵ select</span>}
                  </button>
                ))}
              </div>
              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 16, fontSize: 10, color: 'var(--mu2)' }}>
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
