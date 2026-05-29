'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

type Category = { id: string; name: string; icon: string; color: string; monthly_limit: number; sort_order: number }
type Actual = { category_id: string; spent: number; month: number; year: number }

const ICONS = ['🛒','💻','📱','✈️','🍽️','🏥','📚','🎯','💼','🏠','⚡','🎨','Other']

export default function BudgetPage() {
  const [cats, setCats] = useState<Category[]>([])
  const [actuals, setActuals] = useState<Actual[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState({ name: '', icon: '💼', color: '#6366f1', monthly_limit: '' })

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [{ data: c }, { data: a }] = await Promise.all([
      sb.from('budget_categories').select('*').eq('user_id', user.id).order('sort_order'),
      sb.from('budget_actuals').select('*').eq('user_id', user.id).eq('month', month).eq('year', year),
    ])
    setCats(c ?? [])
    setActuals(a ?? [])
    setLoading(false)
  }

  async function addCat(e: React.FormEvent) {
    e.preventDefault()
    const sb = createClient()
    const { error } = await sb.from('budget_categories').insert({ user_id: userId, ...form, monthly_limit: parseFloat(form.monthly_limit), sort_order: cats.length })
    if (error) { toast.error('Failed to add category'); return }
    toast.success('Category added ✓')
    setShowForm(false)
    setForm({ name: '', icon: '💼', color: '#6366f1', monthly_limit: '' })
    load()
  }

  async function remove(id: string) {
    const sb = createClient()
    await sb.from('budget_categories').delete().eq('id', id)
    toast.success('Removed')
    setCats(cats.filter(c => c.id !== id))
  }

  function getSpent(catId: string) {
    return actuals.find(a => a.category_id === catId)?.spent ?? 0
  }

  function getPct(catId: string, limit: number) {
    if (!limit) return 0
    return Math.min(100, (getSpent(catId) / limit) * 100)
  }

  function scoreEmoji(pct: number) {
    if (pct < 40) return '😊'
    if (pct < 70) return '😐'
    if (pct < 90) return '😬'
    return '🔥'
  }

  const totalBudget = cats.reduce((s, c) => s + Number(c.monthly_limit), 0)
  const totalSpent = cats.reduce((s, c) => s + getSpent(c.id), 0)

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 className="page-title">Budget Planner</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Set your budget, own your spending.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add category</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Monthly Budget', value: `$${totalBudget.toFixed(2)}`, color: '#6366f1' },
            { label: 'Spent This Month', value: `$${totalSpent.toFixed(2)}`, color: totalSpent > totalBudget ? '#ef4444' : '#ff7043' },
            { label: 'Remaining', value: `$${Math.max(0, totalBudget - totalSpent).toFixed(2)}`, color: '#10b981' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)' }}>
            <h2 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 15, fontWeight: 800 }}>
              {now.toLocaleString('default', { month: 'long' })} {year} Budget
            </h2>
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.form
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                onSubmit={addCat} style={{ padding: '20px 24px', borderBottom: '1px solid var(--bd)', background: 'rgba(99,102,241,0.04)', overflow: 'hidden' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Category Name</label>
                    <input className="input" style={{ marginTop: 6 }} required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Software" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Monthly Limit ($)</label>
                    <input className="input" style={{ marginTop: 6 }} type="number" min="0" step="0.01" required value={form.monthly_limit} onChange={e => setForm(f => ({ ...f, monthly_limit: e.target.value }))} placeholder="500" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Icon</label>
                    <select className="input" style={{ marginTop: 6 }} value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}>
                      {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn-primary">Add category</button>
                  <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {loading ? (
            <div style={{ padding: 24 }}>{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 8 }} />)}</div>
          ) : cats.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🎯</span>
              <h3>Set your budget, own your spending</h3>
              <p>Tell FINNMGR how much you want to spend each month. We&apos;ll tell you when you&apos;re getting close.</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>Create first category →</button>
            </div>
          ) : (
            <div style={{ padding: '8px 24px 24px' }}>
              {cats.map((cat, i) => {
                const spent = getSpent(cat.id)
                const pct = getPct(cat.id, cat.monthly_limit)
                const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981'
                return (
                  <motion.div key={cat.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    style={{ padding: '16px 0', borderBottom: i < cats.length - 1 ? '1px solid var(--bd)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{cat.icon}</span>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 13 }}>{cat.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--mu)' }}>${spent.toFixed(2)} of ${Number(cat.monthly_limit).toFixed(2)}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18 }}>{scoreEmoji(pct)}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{pct.toFixed(0)}%</span>
                        <button onClick={() => remove(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, opacity: 0.5 }}>✕</button>
                      </div>
                    </div>
                    <div className="progress-track">
                      <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.06 + 0.2 }} style={{ background: barColor }} />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
