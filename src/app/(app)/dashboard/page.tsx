'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CountUp from 'react-countup'
import { motion } from 'framer-motion'

function greeting(name: string) {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return `Good morning, ${name} ☀️`
  if (h >= 12 && h < 17) return `Good afternoon, ${name} 👋`
  if (h >= 17 && h < 21) return `Good evening, ${name} 🌆`
  return `You're up late, ${name} 🌙 — the hustle is real`
}

const cardVar = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.07, duration: 0.4, ease: 'easeOut' as const } }),
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [stats, setStats] = useState({ income: 0, expenses: 0, invoices: 0, documents: 0, clients: 0, overdue: 0 })
  const [recent, setRecent] = useState<{ id: string; description?: string; client_name?: string; amount: number; type: string; date?: string; status?: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user: u } } = await sb.auth.getUser()
      if (!u) return
      setUser({ name: u.user_metadata?.full_name?.split(' ')[0] ?? 'there', email: u.email ?? '' })

      const [inc, exp, inv, docs, clients] = await Promise.all([
        sb.from('income').select('amount').eq('user_id', u.id),
        sb.from('expenses').select('amount').eq('user_id', u.id),
        sb.from('invoices').select('id,status').eq('user_id', u.id),
        sb.from('documents').select('id').eq('user_id', u.id),
        sb.from('clients').select('id').eq('user_id', u.id),
      ])

      const totalIncome = (inc.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const totalExp = (exp.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const overdue = (inv.data ?? []).filter(i => i.status === 'overdue').length

      setStats({ income: totalIncome, expenses: totalExp, invoices: inv.data?.length ?? 0, documents: docs.data?.length ?? 0, clients: clients.data?.length ?? 0, overdue })

      const { data: recentInc } = await sb.from('income').select('id,client_name,amount,date').eq('user_id', u.id).order('date', { ascending: false }).limit(3)
      const { data: recentExp } = await sb.from('expenses').select('id,vendor,amount,date').eq('user_id', u.id).order('date', { ascending: false }).limit(3)

      const combined = [
        ...(recentInc ?? []).map(r => ({ ...r, description: r.client_name, type: 'income' })),
        ...(recentExp ?? []).map(r => ({ ...r, description: r.vendor, type: 'expense' })),
      ].sort((a, b) => new Date(b.date ?? '').getTime() - new Date(a.date ?? '').getTime()).slice(0, 5)

      setRecent(combined)
      setLoading(false)
    }
    load()
  }, [])

  const STATS = [
    { label: 'Total Income', value: stats.income, prefix: '$', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: '💰' },
    { label: 'Total Expenses', value: stats.expenses, prefix: '$', color: '#ff7043', bg: 'rgba(255,112,67,0.1)', icon: '🧮' },
    { label: 'Net Profit', value: stats.income - stats.expenses, prefix: '$', color: '#6366f1', bg: 'rgba(99,102,241,0.1)', icon: '📊' },
    { label: 'Invoices', value: stats.invoices, prefix: '', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', icon: '🧾' },
    { label: 'Clients', value: stats.clients, prefix: '', color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', icon: '👥' },
    { label: 'Documents', value: stats.documents, prefix: '', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '📁' },
  ]

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 40, width: 280, marginBottom: 32 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[...Array(6)].map((_, i) => <div key={i} style={{ height: 100 }} className="skeleton" />)}
        </div>
        <div style={{ height: 300 }} className="skeleton" />
      </div>
    )
  }

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 className="page-title">{user ? greeting(user.name) : 'Dashboard'}</h1>
          <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Here&apos;s your financial overview.</p>
          {stats.overdue > 0 && (
            <div style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ {stats.overdue} invoice{stats.overdue > 1 ? 's' : ''} overdue — <a href="/invoices" style={{ color: '#ef4444', fontWeight: 700 }}>view now →</a>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
          {STATS.map((s, i) => (
            <motion.div key={s.label} className="stat-card" custom={i} variants={cardVar} initial="hidden" animate="visible">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.value < 0 ? '#ef4444' : s.color }}>
                {s.prefix}
                <CountUp end={Math.abs(s.value)} decimals={s.prefix ? 2 : 0} duration={1.2} separator="," />
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }} style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Recent Activity</h2>
            <div className="live-dot" />
          </div>
          {recent.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📊</span>
              <h3>Nothing here yet — let&apos;s change that</h3>
              <p>Add your first income or expense to start tracking your finances.</p>
              <a href="/income" className="btn-primary" style={{ textDecoration: 'none', marginTop: 4 }}>Add income →</a>
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
                        <span style={{ fontSize: 13 }}>{r.type === 'income' ? '💰' : '🧮'}</span>
                        <span style={{ fontWeight: 500 }}>{r.description ?? '—'}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--mu)', fontSize: 12 }}>{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: r.type === 'income' ? '#10b981' : '#ff7043' }}>
                      {r.type === 'income' ? '+' : '-'}${Number(r.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
