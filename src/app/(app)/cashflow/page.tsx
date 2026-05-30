'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function CashflowPage() {
  const [data, setData] = useState<{ month: string; income: number; expenses: number; net: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return

      const [{ data: income }, { data: expenses }] = await Promise.all([
        sb.from('income').select('amount,date').eq('user_id', user.id),
        sb.from('expenses').select('amount,date').eq('user_id', user.id),
      ])

      const months: Record<string, { income: number; expenses: number }> = {}
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
        months[key] = { income: 0, expenses: 0 }
      }

      ;(income ?? []).forEach(r => {
        const d = new Date(r.date)
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
        if (months[key]) months[key].income += Number(r.amount)
      })
      ;(expenses ?? []).forEach(r => {
        const d = new Date(r.date)
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
        if (months[key]) months[key].expenses += Number(r.amount)
      })

      const chartData = Object.entries(months).map(([month, v]) => ({ month, ...v, net: v.income - v.expenses }))
      setData(chartData)

      const totalInc = (income ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const totalExp = (expenses ?? []).reduce((s, r) => s + Number(r.amount), 0)
      setBalance(totalInc - totalExp)
      setLoading(false)
    }
    load()
  }, [])

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) => {
    if (!active || !payload) return null
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink)' }}>{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.name === 'income' ? '#10b981' : p.name === 'expenses' ? '#ff7043' : p.value >= 0 ? '#6366f1' : '#ef4444' }}>
            {p.name}: ${p.value.toFixed(2)}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 className="page-title">Cash Flow</h1>
          <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Your money in, money out — at a glance.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Net Balance', value: `${balance >= 0 ? '' : '-'}$${Math.abs(balance).toFixed(2)}`, color: balance >= 0 ? '#10b981' : '#ef4444' },
            { label: 'Last 6 Months Income', value: `$${data.reduce((s,d) => s+d.income,0).toFixed(2)}`, color: '#10b981' },
            { label: 'Last 6 Months Expenses', value: `$${data.reduce((s,d) => s+d.expenses,0).toFixed(2)}`, color: '#ff7043' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)', fontSize: 15, fontWeight: 800, marginBottom: 24 }}>Income vs Expenses (6 months)</h2>
          {loading ? (
            <div className="skeleton" style={{ height: 280 }} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} barGap={4}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="income" name="income" fill="#10b981" radius={[6,6,0,0]} animationBegin={200} animationDuration={800} />
                <Bar dataKey="expenses" name="expenses" fill="#ff7043" radius={[6,6,0,0]} animationBegin={300} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card" style={{ padding: '24px', marginTop: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)', fontSize: 15, fontWeight: 800, marginBottom: 20 }}>Monthly Net</h2>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="net" name="net" radius={[6,6,0,0]} animationBegin={400} animationDuration={800}>
                  {data.map((entry, i) => <Cell key={i} fill={entry.net >= 0 ? '#6366f1' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>
    </div>
  )
}
