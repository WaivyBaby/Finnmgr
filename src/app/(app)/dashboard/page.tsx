'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import CountUp from 'react-countup'
import { motion, AnimatePresence } from 'framer-motion'
import ReactConfetti from 'react-confetti'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────
type Stats = { income: number; expenses: number; invoices: number; documents: number; clients: number; overdue: number }
type Recent = { id: string; description: string; amount: number; type: string; date: string }
type MonthData = { label: string; income: number; expenses: number; net: number }
type Modal = 'income' | 'expense' | 'invoice' | 'client' | null

const CASH_AVAILABLE = 34200
const HEALTH_SCORE = 82
const CHECKLIST_KEY = 'finnmgr_checklist'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function greeting(name: string) {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return `Good morning, ${name} ☀️`
  if (h >= 12 && h < 17) return `Good afternoon, ${name} 👋`
  if (h >= 17 && h < 21) return `Good evening, ${name} 🌆`
  return `You're up late, ${name} 🌙 — the hustle is real`
}

function buildMonthly(income: { amount: number; date: string }[], expenses: { amount: number; date: string }[], quarterly: boolean): MonthData[] {
  const now = new Date()
  if (!quarterly) {
    const months: Record<string, MonthData> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleString('default', { month: 'short' })
      months[key] = { label: key, income: 0, expenses: 0, net: 0 }
    }
    income.forEach(r => {
      const k = new Date(r.date).toLocaleString('default', { month: 'short' })
      if (months[k]) months[k].income += Number(r.amount)
    })
    expenses.forEach(r => {
      const k = new Date(r.date).toLocaleString('default', { month: 'short' })
      if (months[k]) months[k].expenses += Number(r.amount)
    })
    return Object.values(months).map(m => ({ ...m, net: m.income - m.expenses }))
  } else {
    const qs: Record<string, MonthData> = { Q1: { label: 'Q1', income: 0, expenses: 0, net: 0 }, Q2: { label: 'Q2', income: 0, expenses: 0, net: 0 }, Q3: { label: 'Q3', income: 0, expenses: 0, net: 0 }, Q4: { label: 'Q4', income: 0, expenses: 0, net: 0 } }
    income.forEach(r => { const q = `Q${Math.ceil((new Date(r.date).getMonth() + 1) / 3)}`; if (qs[q]) qs[q].income += Number(r.amount) })
    expenses.forEach(r => { const q = `Q${Math.ceil((new Date(r.date).getMonth() + 1) / 3)}`; if (qs[q]) qs[q].expenses += Number(r.amount) })
    return Object.values(qs).map(q => ({ ...q, net: q.income - q.expenses }))
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink)' }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color }}>{p.name}: ${Number(p.value).toFixed(0)}</p>)}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
            <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>{title}</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: 24 }}>{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null)
  const [stats, setStats] = useState<Stats>({ income: 0, expenses: 0, invoices: 0, documents: 0, clients: 0, overdue: 0 })
  const [recent, setRecent] = useState<Recent[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([])
  const [allIncome, setAllIncome] = useState<{ amount: number; date: string }[]>([])
  const [allExpenses, setAllExpenses] = useState<{ amount: number; date: string }[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [chartView, setChartView] = useState<'monthly' | 'quarterly'>('monthly')
  const [scenario, setScenario] = useState<'expected' | 'best' | 'worst'>('expected')
  const [affordAmount, setAffordAmount] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [confetti, setConfetti] = useState(false)
  const [checklist, setChecklist] = useState<boolean[]>([false, false, false, false, false, false, false])

  // Quick-add form state
  const [incForm, setIncForm] = useState({ client_name: '', amount: '', category: 'Design', date: new Date().toISOString().split('T')[0] })
  const [expForm, setExpForm] = useState({ vendor: '', amount: '', category: 'Operations', date: new Date().toISOString().split('T')[0] })
  const [invForm, setInvForm] = useState({ client_name: '', client_email: '', due_date: '', amount: '' })
  const [cliForm, setCliForm] = useState({ name: '', email: '', company: '' })
  const [saving, setSaving] = useState(false)

  // Load checklist from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_KEY)
      if (saved) setChecklist(JSON.parse(saved))
    } catch {}
  }, [])

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user: u } } = await sb.auth.getUser()
    if (!u) return
    setUser({ id: u.id, name: u.user_metadata?.full_name?.split(' ')[0] ?? 'there', email: u.email ?? '' })

    const [inc, exp, inv, docs, clients, recentInc, recentExp] = await Promise.all([
      sb.from('income').select('amount,date').eq('user_id', u.id),
      sb.from('expenses').select('amount,date').eq('user_id', u.id),
      sb.from('invoices').select('id,status').eq('user_id', u.id),
      sb.from('documents').select('id').eq('user_id', u.id),
      sb.from('clients').select('id').eq('user_id', u.id),
      sb.from('income').select('id,client_name,amount,date').eq('user_id', u.id).order('date', { ascending: false }).limit(4),
      sb.from('expenses').select('id,vendor,amount,date').eq('user_id', u.id).order('date', { ascending: false }).limit(4),
    ])

    const totalIncome = (inc.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const totalExp = (exp.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const overdue = (inv.data ?? []).filter(i => i.status === 'overdue').length

    setStats({ income: totalIncome, expenses: totalExp, invoices: inv.data?.length ?? 0, documents: docs.data?.length ?? 0, clients: clients.data?.length ?? 0, overdue })
    setAllIncome(inc.data ?? [])
    setAllExpenses(exp.data ?? [])
    setMonthlyData(buildMonthly(inc.data ?? [], exp.data ?? [], false))

    const combined = [
      ...(recentInc.data ?? []).map(r => ({ id: r.id, description: r.client_name ?? '—', amount: Number(r.amount), type: 'income', date: r.date })),
      ...(recentExp.data ?? []).map(r => ({ id: r.id, description: r.vendor, amount: Number(r.amount), type: 'expense', date: r.date })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)

    setRecent(combined)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setMonthlyData(buildMonthly(allIncome, allExpenses, chartView === 'quarterly'))
  }, [chartView, allIncome, allExpenses])

  // ── Checklist ───────────────────────────────────────────────────────────────
  function tickChecklist(i: number) {
    const next = [...checklist]
    next[i] = !next[i]
    setChecklist(next)
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next)) } catch {}
    if (next.every(Boolean)) {
      setConfetti(true)
      toast.success('Setup complete! You\'re officially in business 🎉')
      setTimeout(() => setConfetti(false), 5000)
    }
  }

  const CHECKLIST_ITEMS = [
    'Complete your profile',
    'Add your first client',
    'Create your first invoice',
    'Record your first income',
    'Log your first expense',
    'Upload a document',
    'Set your budget',
  ]

  // ── Affordability ───────────────────────────────────────────────────────────
  const amt = parseFloat(affordAmount) || 0
  const affordPct = amt / CASH_AVAILABLE
  const affordResult = amt === 0 ? null : affordPct <= 0.3 ? { label: "Yes, you can afford this ✓", color: '#10b981', bg: 'rgba(16,185,129,0.1)' }
    : affordPct <= 0.7 ? { label: 'Possible but tight ⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    : { label: 'Not recommended right now ✗', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }

  // ── Scenarios ───────────────────────────────────────────────────────────────
  const scenarioMultiplier = scenario === 'best' ? 1.2 : scenario === 'worst' ? 0.8 : 1
  const scenarioIncome = stats.income * scenarioMultiplier
  const scenarioExpenses = stats.expenses * (scenario === 'best' ? 0.9 : scenario === 'worst' ? 1.15 : 1)
  const scenarioProfit = scenarioIncome - scenarioExpenses

  // ── KPI cards ───────────────────────────────────────────────────────────────
  const STATS = [
    { label: 'Total Income', value: stats.income, goal: 50000, prefix: '$', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: '💰' },
    { label: 'Total Expenses', value: stats.expenses, goal: 20000, prefix: '$', color: '#ff7043', bg: 'rgba(255,112,67,0.1)', icon: '🧮' },
    { label: 'Net Profit', value: stats.income - stats.expenses, goal: 30000, prefix: '$', color: '#6366f1', bg: 'rgba(99,102,241,0.1)', icon: '📊' },
    { label: 'Invoices', value: stats.invoices, goal: 20, prefix: '', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', icon: '🧾' },
    { label: 'Clients', value: stats.clients, goal: 10, prefix: '', color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', icon: '👥' },
    { label: 'Documents', value: stats.documents, goal: 15, prefix: '', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '📁' },
  ]

  // ── Quick-add handlers ──────────────────────────────────────────────────────
  async function submitIncome(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('income').insert({ user_id: user!.id, ...incForm, amount: parseFloat(incForm.amount) })
    setSaving(false)
    if (error) { toast.error('Failed to add income'); return }
    toast.success('Income added ✓'); setModal(null)
    setIncForm({ client_name: '', amount: '', category: 'Design', date: new Date().toISOString().split('T')[0] })
    load()
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('expenses').insert({ user_id: user!.id, ...expForm, amount: parseFloat(expForm.amount) })
    setSaving(false)
    if (error) { toast.error('Failed to add expense'); return }
    toast.success('Expense added ✓'); setModal(null)
    setExpForm({ vendor: '', amount: '', category: 'Operations', date: new Date().toISOString().split('T')[0] })
    load()
  }

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const num = `INV-${Date.now().toString().slice(-6)}`
    const total = parseFloat(invForm.amount)
    const { error } = await sb.from('invoices').insert({
      user_id: user!.id, invoice_number: num, client_name: invForm.client_name,
      client_email: invForm.client_email, due_date: invForm.due_date, total, balance_due: total,
      line_items: [{ description: 'Services', quantity: 1, rate: total }],
    })
    setSaving(false)
    if (error) { toast.error('Failed to create invoice'); return }
    toast.success('Invoice created ✓'); setModal(null)
    setInvForm({ client_name: '', client_email: '', due_date: '', amount: '' })
    load()
  }

  async function submitClient(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('clients').insert({ user_id: user!.id, ...cliForm })
    setSaving(false)
    if (error) { toast.error('Failed to add client'); return }
    toast.success('Client added ✓'); setModal(null)
    setCliForm({ name: '', email: '', company: '' })
    load()
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 40, width: 300, marginBottom: 24 }} className="skeleton" />
        <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ height: 38, width: 140 }} className="skeleton" />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          {[...Array(6)].map((_, i) => <div key={i} style={{ height: 110 }} className="skeleton" />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div style={{ height: 300 }} className="skeleton" />
          <div style={{ height: 300 }} className="skeleton" />
        </div>
      </div>
    )
  }

  const inputStyle = { width: '100%', padding: '10px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit' }

  return (
    <div className="page-content">
      {confetti && <ReactConfetti recycle={false} numberOfPieces={400} />}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">{user ? greeting(user.name) : 'Dashboard'}</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Here&apos;s your financial overview.</p>
          </div>
          {/* Quick actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([
              { label: '+ Income', modal: 'income' as Modal, color: '#10b981' },
              { label: '+ Expense', modal: 'expense' as Modal, color: '#ff7043' },
              { label: '+ Invoice', modal: 'invoice' as Modal, color: '#6366f1' },
              { label: '+ Client', modal: 'client' as Modal, color: '#0ea5e9' },
            ] as const).map(a => (
              <button key={a.label} onClick={() => setModal(a.modal)}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${a.color}22`, background: `${a.color}11`, color: a.color, fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = `${a.color}22` }}
                onMouseLeave={e => { e.currentTarget.style.background = `${a.color}11` }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {stats.overdue > 0 && (
          <div style={{ marginBottom: 20, padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚠️ {stats.overdue} invoice{stats.overdue > 1 ? 's' : ''} overdue —{' '}
            <a href="/invoices" style={{ color: '#ef4444', fontWeight: 700 }}>view now →</a>
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          {STATS.map((s, i) => {
            const isExpanded = expandedCard === s.label
            const goalPct = Math.min(100, (Math.abs(s.value) / s.goal) * 100)
            return (
              <motion.div
                key={s.label}
                className="stat-card"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.07, duration: 0.4, ease: 'easeOut' }}
                onClick={() => setExpandedCard(isExpanded ? null : s.label)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, fontSize: 18 }}>{s.icon}</div>
                  <span style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.value < 0 ? '#ef4444' : s.color }}>
                  {s.prefix}<CountUp end={Math.abs(s.value)} decimals={s.prefix ? 2 : 0} duration={1.2} separator="," />
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--mu)', marginBottom: 6 }}>
                          <span>Goal: {s.prefix}{s.goal.toLocaleString()}</span>
                          <span style={{ color: s.color, fontWeight: 700 }}>{goalPct.toFixed(0)}%</span>
                        </div>
                        <div className="progress-track">
                          <motion.div className="progress-fill"
                            initial={{ width: 0 }} animate={{ width: `${goalPct}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            style={{ background: s.color }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* ── Charts + Health Score row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Revenue vs Expenses */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>Revenue vs Expenses</h2>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['monthly', 'quarterly'] as const).map(v => (
                  <button key={v} onClick={() => setChartView(v)}
                    style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      background: chartView === v ? '#6366f1' : 'var(--bg3)',
                      color: chartView === v ? '#fff' : 'var(--mu)', transition: 'all 0.15s' }}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} tickFormatter={v => `$${v}`} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[5, 5, 0, 0]} animationBegin={200} animationDuration={700} />
                <Bar dataKey="expenses" name="Expenses" fill="#ff7043" radius={[5, 5, 0, 0]} animationBegin={300} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Health Score + Checklist */}
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>

            {/* Health Score */}
            <div className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
              <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 2 }}>Business Health Score</p>
              <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 16 }}>Based on your real data</p>
              <div style={{ fontSize: 42, fontWeight: 900, color: '#10b981', fontFamily: 'Cabinet Grotesk, sans-serif', letterSpacing: '-0.04em' }}>
                <CountUp end={HEALTH_SCORE} duration={1.5} />
                <span style={{ fontSize: 18, color: 'var(--mu)' }}>/100</span>
              </div>
              <div style={{ marginTop: 12, marginBottom: 8 }}>
                <div className="progress-track">
                  <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${HEALTH_SCORE}%` }} transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }} style={{ background: 'linear-gradient(90deg, #10b981, #6366f1)' }} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>🚀 Excellent — keep it up!</p>
            </div>

            {/* Setup Checklist */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>Setup Checklist</p>
                <span style={{ fontSize: 11, color: 'var(--mu)' }}>{checklist.filter(Boolean).length}/{CHECKLIST_ITEMS.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CHECKLIST_ITEMS.map((item, i) => (
                  <button key={i} onClick={() => tickChecklist(i)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: checklist[i] ? 'none' : '1.5px solid var(--bd2)', background: checklist[i] ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                      {checklist[i] && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 12, color: checklist[i] ? 'var(--mu)' : 'var(--ink)', textDecoration: checklist[i] ? 'line-through' : 'none', transition: 'all 0.2s' }}>{item}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Cash Flow + Affordability + Scenarios row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Cash Flow Line Chart */}
          <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.4 }}>
            <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', marginBottom: 20 }}>Cash Flow</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} tickFormatter={v => `$${v}`} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="net" name="Net" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} animationBegin={200} animationDuration={700} />
                <Line type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 2" dot={false} animationBegin={300} animationDuration={700} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Affordability + Scenarios */}
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>

            {/* Affordability Calculator */}
            <div className="glass-card" style={{ padding: 20 }}>
              <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>Affordability Calculator</p>
              <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 14 }}>Cash available: ${CASH_AVAILABLE.toLocaleString()}</p>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 14 }}>$</span>
                <input
                  type="number" min="0" value={affordAmount}
                  onChange={e => setAffordAmount(e.target.value)}
                  placeholder="Enter purchase amount"
                  style={{ ...inputStyle, paddingLeft: 28 }} />
              </div>
              <AnimatePresence mode="wait">
                {affordResult && (
                  <motion.div key={affordResult.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
                    style={{ padding: '10px 14px', borderRadius: 10, background: affordResult.bg, color: affordResult.color, fontSize: 13, fontWeight: 700, transition: 'all 0.3s' }}>
                    {affordResult.label}
                    <div style={{ marginTop: 6 }}>
                      <div className="progress-track">
                        <motion.div className="progress-fill" animate={{ width: `${Math.min(100, affordPct * 100)}%` }} transition={{ duration: 0.4 }} style={{ background: affordResult.color }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Forecast Scenarios */}
            <div className="glass-card" style={{ padding: 20 }}>
              <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 14 }}>Forecast Scenarios</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {(['expected', 'best', 'worst'] as const).map(s => (
                  <button key={s} onClick={() => setScenario(s)}
                    style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                      background: scenario === s ? (s === 'best' ? '#10b981' : s === 'worst' ? '#ef4444' : '#6366f1') : 'var(--bg3)',
                      color: scenario === s ? '#fff' : 'var(--mu)' }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={scenario} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                  {[
                    { label: 'Projected Income', value: scenarioIncome, color: '#10b981' },
                    { label: 'Projected Expenses', value: scenarioExpenses, color: '#ff7043' },
                    { label: 'Projected Profit', value: scenarioProfit, color: scenarioProfit >= 0 ? '#6366f1' : '#ef4444' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--mu)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: row.color, fontFamily: 'DM Mono, monospace' }}>${row.value.toFixed(0)}</span>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* ── Recent Activity ── */}
        <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.4 }} style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>Recent Activity</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="live-dot" />
              <span style={{ fontSize: 11, color: 'var(--mu)' }}>Live</span>
            </div>
          </div>
          {recent.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📊</span>
              <h3>Nothing here yet — let&apos;s change that</h3>
              <p>Add your first income or expense to start tracking your finances.</p>
              <button className="btn-primary" onClick={() => setModal('income')} style={{ marginTop: 4 }}>Add income →</button>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{r.type === 'income' ? '💰' : '🧮'}</span>
                        <span style={{ fontWeight: 500 }}>{r.description}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--mu)', fontSize: 12 }}>{new Date(r.date).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: r.type === 'income' ? '#10b981' : '#ff7043' }}>
                      {r.type === 'income' ? '+' : '-'}${r.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      </motion.div>

      {/* ── Modals ── */}
      {modal === 'income' && (
        <Modal title="Add Income" onClose={() => setModal(null)}>
          <form onSubmit={submitIncome}>
            <FormField label="Client / Source">
              <input style={inputStyle} required placeholder="Acme Corp" value={incForm.client_name} onChange={e => setIncForm(f => ({ ...f, client_name: e.target.value }))} />
            </FormField>
            <FormField label="Amount ($)">
              <input style={inputStyle} type="number" min="0" step="0.01" required placeholder="0.00" value={incForm.amount} onChange={e => setIncForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
            <FormField label="Category">
              <select style={inputStyle} value={incForm.category} onChange={e => setIncForm(f => ({ ...f, category: e.target.value }))}>
                {['Design','Development','Consulting','Retainer','E-commerce','Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Date">
              <input style={inputStyle} type="date" required value={incForm.date} onChange={e => setIncForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px' }}>{saving ? 'Saving...' : 'Add Income'}</button>
              <button type="button" className="btn-ghost" onClick={() => setModal(null)} style={{ padding: '11px 20px' }}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'expense' && (
        <Modal title="Add Expense" onClose={() => setModal(null)}>
          <form onSubmit={submitExpense}>
            <FormField label="Vendor">
              <input style={inputStyle} required placeholder="Adobe, AWS, etc." value={expForm.vendor} onChange={e => setExpForm(f => ({ ...f, vendor: e.target.value }))} />
            </FormField>
            <FormField label="Amount ($)">
              <input style={inputStyle} type="number" min="0" step="0.01" required placeholder="0.00" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
            <FormField label="Category">
              <select style={inputStyle} value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}>
                {['Operations','Software','Marketing','Payroll','Travel','Meals','Equipment','Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Date">
              <input style={inputStyle} type="date" required value={expForm.date} onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px', background: 'linear-gradient(135deg,#ff7043,#f59e0b)' }}>{saving ? 'Saving...' : 'Add Expense'}</button>
              <button type="button" className="btn-ghost" onClick={() => setModal(null)} style={{ padding: '11px 20px' }}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'invoice' && (
        <Modal title="Create Invoice" onClose={() => setModal(null)}>
          <form onSubmit={submitInvoice}>
            <FormField label="Client Name">
              <input style={inputStyle} required placeholder="Acme Corp" value={invForm.client_name} onChange={e => setInvForm(f => ({ ...f, client_name: e.target.value }))} />
            </FormField>
            <FormField label="Client Email">
              <input style={inputStyle} type="email" placeholder="client@example.com" value={invForm.client_email} onChange={e => setInvForm(f => ({ ...f, client_email: e.target.value }))} />
            </FormField>
            <FormField label="Amount ($)">
              <input style={inputStyle} type="number" min="0" step="0.01" required placeholder="0.00" value={invForm.amount} onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
            <FormField label="Due Date">
              <input style={inputStyle} type="date" required value={invForm.due_date} onChange={e => setInvForm(f => ({ ...f, due_date: e.target.value }))} />
            </FormField>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px' }}>{saving ? 'Creating...' : 'Create Invoice'}</button>
              <button type="button" className="btn-ghost" onClick={() => setModal(null)} style={{ padding: '11px 20px' }}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'client' && (
        <Modal title="Add Client" onClose={() => setModal(null)}>
          <form onSubmit={submitClient}>
            <FormField label="Full Name">
              <input style={inputStyle} required placeholder="Jane Smith" value={cliForm.name} onChange={e => setCliForm(f => ({ ...f, name: e.target.value }))} />
            </FormField>
            <FormField label="Company">
              <input style={inputStyle} placeholder="Acme Corp" value={cliForm.company} onChange={e => setCliForm(f => ({ ...f, company: e.target.value }))} />
            </FormField>
            <FormField label="Email">
              <input style={inputStyle} type="email" placeholder="jane@example.com" value={cliForm.email} onChange={e => setCliForm(f => ({ ...f, email: e.target.value }))} />
            </FormField>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>{saving ? 'Adding...' : 'Add Client'}</button>
              <button type="button" className="btn-ghost" onClick={() => setModal(null)} style={{ padding: '11px 20px' }}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
