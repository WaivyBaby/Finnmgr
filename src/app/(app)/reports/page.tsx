'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'

const COLORS = ['#6366f1','#10b981','#ff7043','#0ea5e9','#f59e0b','#8b5cf6','#ec4899','#14b8a6']

export default function ReportsPage() {
  const [stats, setStats] = useState({ income: 0, expenses: 0, invoices: 0, clients: 0, collectionRate: 0 })
  const [expByCat, setExpByCat] = useState<{ name: string; value: number }[]>([])
  const [incByCat, setIncByCat] = useState<{ name: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [healthScore, setHealthScore] = useState(0)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return

      const [{ data: inc }, { data: exp }, { data: inv }, { data: clients }] = await Promise.all([
        sb.from('income').select('amount,category').eq('user_id', user.id),
        sb.from('expenses').select('amount,category').eq('user_id', user.id),
        sb.from('invoices').select('status,total').eq('user_id', user.id),
        sb.from('clients').select('id').eq('user_id', user.id),
      ])

      const totalInc = (inc ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const totalExp = (exp ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const paidInv = (inv ?? []).filter(i => i.status === 'paid').length
      const collRate = inv?.length ? Math.round((paidInv / inv.length) * 100) : 0

      const incCat: Record<string,number> = {}
      ;(inc ?? []).forEach(r => { incCat[r.category] = (incCat[r.category] ?? 0) + Number(r.amount) })
      const expCat: Record<string,number> = {}
      ;(exp ?? []).forEach(r => { expCat[r.category] = (expCat[r.category] ?? 0) + Number(r.amount) })

      setStats({ income: totalInc, expenses: totalExp, invoices: inv?.length ?? 0, clients: clients?.length ?? 0, collectionRate: collRate })
      setIncByCat(Object.entries(incCat).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value))
      setExpByCat(Object.entries(expCat).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value))

      const margin = totalInc > 0 ? ((totalInc - totalExp) / totalInc) * 100 : 0
      const score = Math.min(100, Math.round(
        (margin > 30 ? 30 : margin) +
        (collRate > 80 ? 30 : collRate * 0.375) +
        ((clients?.length ?? 0) > 5 ? 20 : (clients?.length ?? 0) * 4) +
        ((inv?.length ?? 0) > 5 ? 20 : (inv?.length ?? 0) * 4)
      ))
      setHealthScore(score)
      setLoading(false)
    }
    load()
  }, [])

  function scoreLabel(s: number) {
    if (s >= 80) return { label: 'Excellent', color: '#10b981', emoji: '🚀' }
    if (s >= 60) return { label: 'Good', color: '#6366f1', emoji: '😊' }
    if (s >= 40) return { label: 'Fair', color: '#f59e0b', emoji: '😐' }
    return { label: 'Needs Work', color: '#ef4444', emoji: '😬' }
  }

  const { label, color, emoji } = scoreLabel(healthScore)
  const margin = stats.income > 0 ? ((stats.income - stats.expenses) / stats.income * 100) : 0

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
    if (!active || !payload?.[0]) return null
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <p style={{ fontWeight: 600 }}>{payload[0].name}</p>
        <p style={{ color: '#6366f1' }}>${Number(payload[0].value).toFixed(2)}</p>
      </div>
    )
  }

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 className="page-title">Reports</h1>
          <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Your numbers, your story.</p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Total Revenue', value: `$${stats.income.toFixed(2)}`, color: '#10b981' },
            { label: 'Total Expenses', value: `$${stats.expenses.toFixed(2)}`, color: '#ff7043' },
            { label: 'Profit Margin', value: `${margin.toFixed(1)}%`, color: margin > 0 ? '#6366f1' : '#ef4444' },
            { label: 'Collection Rate', value: `${stats.collectionRate}%`, color: '#0ea5e9' },
          ].map((s, i) => (
            <motion.div key={s.label} className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </motion.div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Expense breakdown */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h2 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 15, fontWeight: 800, marginBottom: 20 }}>Expense Breakdown</h2>
            {loading ? <div className="skeleton" style={{ height: 220 }} /> : expByCat.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}><h3>No expenses yet</h3></div>
            ) : (
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={expByCat} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" animationBegin={200} animationDuration={800}>
                      {expByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {expByCat.slice(0,6).map((item, i) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                        <span style={{ fontSize: 12, color: 'var(--ink)' }}>{item.name}</span>
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--mu)' }}>${item.value.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Business Health Score */}
          <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Health Score</h2>
            <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 24 }}>Based on your real data</p>
            <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 16px' }}>
              <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg3)" strokeWidth="10" />
                <motion.circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - healthScore / 100) }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 22 }}>{emoji}</span>
                <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Cabinet Grotesk, sans-serif', color }}>{healthScore}</span>
              </div>
            </div>
            <p style={{ fontWeight: 700, color, fontSize: 14 }}>{label}</p>
          </div>
        </div>

        {/* Income by category */}
        {incByCat.length > 0 && (
          <div className="glass-card" style={{ padding: 24 }}>
            <h2 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 15, fontWeight: 800, marginBottom: 20 }}>Income by Category</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={incByCat} layout="vertical">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#10b981" radius={[0,6,6,0]} animationBegin={200} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>
    </div>
  )
}
