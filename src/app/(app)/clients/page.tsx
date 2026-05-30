'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

type Client = { id: string; name: string; email?: string; phone?: string; company?: string; total_billed: number; total_paid: number; status: string; avatar_color: string; created_at: string }

const COLORS = ['#6366f1','#10b981','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#ff7043']

function initials(name: string) { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) }

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', avatar_color: COLORS[0] })

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await sb.from('clients').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setClients(data ?? [])
    setLoading(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const sb = createClient()
    const { error } = await sb.from('clients').insert({ user_id: userId, ...form })
    if (error) { toast.error('Failed to add client'); return }
    toast.success('Client added ✓')
    setShowForm(false)
    setForm({ name: '', email: '', phone: '', company: '', avatar_color: COLORS[0] })
    load()
  }

  async function remove(id: string) {
    const sb = createClient()
    await sb.from('clients').delete().eq('id', id)
    toast.success('Client removed')
    setClients(clients.filter(c => c.id !== id))
  }

  const active = clients.filter(c => c.status === 'active').length
  const totalBilled = clients.reduce((s, c) => s + Number(c.total_billed), 0)

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 className="page-title">Clients</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Your most valuable relationships.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add client</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Clients', value: String(clients.length), color: '#6366f1' },
            { label: 'Active', value: String(active), color: '#10b981' },
            { label: 'Total Billed', value: `$${totalBilled.toFixed(2)}`, color: '#0ea5e9' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)' }}>
            <h2 style={{ fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)', fontSize: 15, fontWeight: 800 }}>All Clients</h2>
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.form
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                onSubmit={add} style={{ padding: '20px 24px', borderBottom: '1px solid var(--bd)', background: 'rgba(99,102,241,0.04)', overflow: 'hidden' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { key: 'name', label: 'Full Name', placeholder: 'Jane Smith', required: true },
                    { key: 'company', label: 'Company', placeholder: 'Acme Corp' },
                    { key: 'email', label: 'Email', placeholder: 'jane@example.com' },
                    { key: 'phone', label: 'Phone', placeholder: '+1 (555) 000-0000' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                      <input className="input" style={{ marginTop: 6 }} required={f.required} placeholder={f.placeholder}
                        value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Avatar Color</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setForm(f => ({ ...f, avatar_color: c }))}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.avatar_color === c ? '3px solid var(--ink)' : '3px solid transparent', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn-primary">Add client</button>
                  <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {loading ? (
            <div style={{ padding: 24 }}>{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />)}</div>
          ) : clients.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">👥</span>
              <h3>Your first client is your most important</h3>
              <p>Add clients to send invoices faster and track your most valuable relationships.</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>Add client →</button>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Client</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td style={{ paddingLeft: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: c.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: 'white', fontSize: 11, fontWeight: 800 }}>{initials(c.name)}</span>
                        </div>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--mu)', fontSize: 12 }}>{c.email || '—'}</td>
                    <td style={{ color: 'var(--mu)', fontSize: 12 }}>{c.company || '—'}</td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}>
                      <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, padding: '4px 8px', borderRadius: 6 }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  )
}
