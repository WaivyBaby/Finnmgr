'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

type Income = { id: string; date: string; amount: number; client_name?: string; category: string; payment_method?: string; status: string; notes?: string }

const CATEGORIES = ['Design', 'Development', 'Consulting', 'Photography', 'Retainer', 'E-commerce', 'Coaching', 'Writing', 'Marketing', 'Other']
const METHODS = ['Bank Transfer', 'Stripe', 'PayPal', 'Check', 'Cash', 'Venmo', 'Zelle', 'Other']

export default function IncomePage() {
  const [items, setItems] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', client_name: '', category: 'Design', payment_method: 'Bank Transfer', status: 'received', notes: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await sb.from('income').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const sb = createClient()
    const { error } = await sb.from('income').insert({ user_id: userId, ...form, amount: parseFloat(form.amount) })
    if (error) { toast.error('Failed to add income'); return }
    toast.success('Income added ✓')
    setShowForm(false)
    setForm({ date: new Date().toISOString().split('T')[0], amount: '', client_name: '', category: 'Design', payment_method: 'Bank Transfer', status: 'received', notes: '' })
    load()
  }

  async function remove(id: string) {
    const sb = createClient()
    await sb.from('income').delete().eq('id', id)
    toast.success('Removed')
    setItems(items.filter(i => i.id !== id))
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 className="page-title">Income</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Every dollar matters. Track your wins here.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add income</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Income', value: `$${total.toFixed(2)}`, color: '#10b981' },
            { label: 'This Month', value: `$${items.filter(i => new Date(i.date).getMonth() === new Date().getMonth()).reduce((s,i) => s+Number(i.amount),0).toFixed(2)}`, color: '#6366f1' },
            { label: 'Transactions', value: String(items.length), color: '#0ea5e9' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 15, fontWeight: 800 }}>All Income</h2>
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.form
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                onSubmit={add} style={{ padding: '20px 24px', borderBottom: '1px solid var(--bd)', background: 'rgba(99,102,241,0.04)', overflow: 'hidden' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Client / Source</label>
                    <input className="input" style={{ marginTop: 6 }} value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Acme Corp" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Amount ($)</label>
                    <input className="input" style={{ marginTop: 6 }} type="number" min="0" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Date</label>
                    <input className="input" style={{ marginTop: 6 }} type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Category</label>
                    <select className="input" style={{ marginTop: 6 }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Payment Method</label>
                    <select className="input" style={{ marginTop: 6 }} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                      {METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Status</label>
                    <select className="input" style={{ marginTop: 6 }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="received">Received</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn-primary">Save income</button>
                  <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {loading ? (
            <div style={{ padding: 24 }}>{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)}</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">💰</span>
              <h3>Let&apos;s record your first win</h3>
              <p>Every dollar matters. Track your income here and watch your business grow.</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>Add income →</button>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Source</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="group">
                    <td style={{ paddingLeft: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💰</div>
                        <span style={{ fontWeight: 500 }}>{item.client_name || '—'}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--mu)', fontSize: 12 }}>{item.category}</td>
                    <td style={{ color: 'var(--mu)', fontSize: 12 }}>{new Date(item.date).toLocaleDateString()}</td>
                    <td><span className={`status-pill status-${item.status}`}>{item.status}</span></td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color: '#10b981' }}>+${Number(item.amount).toFixed(2)}</span>
                        <button onClick={() => remove(item.id)} style={{ opacity: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, padding: '2px 6px', borderRadius: 6 }} className="del-btn">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
      <style>{`.group:hover .del-btn { opacity: 1 !important; }`}</style>
    </div>
  )
}
