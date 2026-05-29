'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

type Expense = { id: string; date: string; amount: number; vendor: string; category: string; payment_method?: string; is_deductible: boolean; status: string }

const CATEGORIES = ['Operations', 'Software', 'Marketing', 'Payroll', 'Office', 'Travel', 'Meals', 'Equipment', 'Professional Services', 'Insurance', 'Rent', 'Utilities', 'Other']
const METHODS = ['Bank Transfer', 'Credit Card', 'PayPal', 'Check', 'Cash', 'Other']

export default function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', vendor: '', category: 'Operations', payment_method: 'Bank Transfer', is_deductible: true, status: 'paid' })

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await sb.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const sb = createClient()
    const { error } = await sb.from('expenses').insert({ user_id: userId, ...form, amount: parseFloat(form.amount) })
    if (error) { toast.error('Failed to add expense'); return }
    toast.success('Expense added ✓')
    setShowForm(false)
    setForm({ date: new Date().toISOString().split('T')[0], amount: '', vendor: '', category: 'Operations', payment_method: 'Bank Transfer', is_deductible: true, status: 'paid' })
    load()
  }

  async function remove(id: string) {
    const sb = createClient()
    await sb.from('expenses').delete().eq('id', id)
    toast.success('Removed')
    setItems(items.filter(i => i.id !== id))
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0)
  const deductible = items.filter(i => i.is_deductible).reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 className="page-title">Expenses</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>No expenses yet — enjoy it while it lasts 😄</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add expense</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Expenses', value: `$${total.toFixed(2)}`, color: '#ff7043' },
            { label: 'Tax Deductible', value: `$${deductible.toFixed(2)}`, color: '#10b981' },
            { label: 'Transactions', value: String(items.length), color: '#6366f1' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)' }}>
            <h2 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 15, fontWeight: 800 }}>All Expenses</h2>
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.form
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                onSubmit={add} style={{ padding: '20px 24px', borderBottom: '1px solid var(--bd)', background: 'rgba(255,112,67,0.04)', overflow: 'hidden' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vendor</label>
                    <input className="input" style={{ marginTop: 6 }} required value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Adobe, AWS, etc." />
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
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                      <input type="checkbox" checked={form.is_deductible} onChange={e => setForm(f => ({ ...f, is_deductible: e.target.checked }))} />
                      Tax deductible
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn-primary">Save expense</button>
                  <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {loading ? (
            <div style={{ padding: 24 }}>{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)}</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🧮</span>
              <h3>No expenses yet — enjoy it while it lasts 😄</h3>
              <p>Add your business expenses to track spending and maximize tax deductions.</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>Add expense →</button>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Vendor</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Deductible</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ paddingLeft: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,112,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🧮</div>
                        <span style={{ fontWeight: 500 }}>{item.vendor}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--mu)', fontSize: 12 }}>{item.category}</td>
                    <td style={{ color: 'var(--mu)', fontSize: 12 }}>{new Date(item.date).toLocaleDateString()}</td>
                    <td><span style={{ fontSize: 11, color: item.is_deductible ? '#10b981' : 'var(--mu)' }}>{item.is_deductible ? '✓ Yes' : 'No'}</span></td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color: '#ff7043' }}>-${Number(item.amount).toFixed(2)}</span>
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
      <style>{`.group:hover .del-btn, tr:hover .del-btn { opacity: 1 !important; }`}</style>
    </div>
  )
}
