'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const [form, setForm] = useState({ full_name: '', business_name: '', phone: '', website: '', invoice_prefix: 'INV', currency: 'USD' })
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      setUserId(user.id)
      setEmail(user.email ?? '')
      const { data } = await sb.from('profiles').select('*').eq('id', user.id).single()
      if (data) setForm({ full_name: data.full_name ?? '', business_name: data.business_name ?? '', phone: data.phone ?? '', website: data.website ?? '', invoice_prefix: data.invoice_prefix ?? 'INV', currency: data.currency ?? 'USD' })
      setLoading(false)
    }
    load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('profiles').upsert({ id: userId, ...form, email })
    if (error) { toast.error('Failed to save'); setSaving(false); return }
    toast.success('Settings saved ✓')
    setSaving(false)
  }

  const fields = [
    { key: 'full_name', label: 'Full Name', placeholder: 'Jane Smith' },
    { key: 'business_name', label: 'Business Name', placeholder: 'Acme Studio' },
    { key: 'phone', label: 'Phone', placeholder: '+1 (555) 000-0000' },
    { key: 'website', label: 'Website', placeholder: 'https://yourbusiness.com' },
    { key: 'invoice_prefix', label: 'Invoice Prefix', placeholder: 'INV' },
  ]

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 className="page-title">Settings</h1>
          <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Everything is under your control here. Changes save automatically.</p>
        </div>

        {loading ? (
          <div className="glass-card" style={{ padding: 32 }}>{[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 16 }} />)}</div>
        ) : (
          <form onSubmit={save}>
            <div className="glass-card" style={{ padding: 32, marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)', fontSize: 16, fontWeight: 800, marginBottom: 24 }}>Profile & Business</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Email</label>
                  <input className="input" style={{ marginTop: 6, opacity: 0.6 }} value={email} disabled />
                </div>
                {fields.map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                    <input className="input" style={{ marginTop: 6 }} placeholder={f.placeholder}
                      value={(form as Record<string,string>)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Currency</label>
                  <select className="input" style={{ marginTop: 6 }} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {['USD','EUR','GBP','CAD','AUD','JPY'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={saving} className="btn-primary" style={{ marginTop: 24 }}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        )}

        <div className="glass-card" style={{ padding: 32, borderColor: 'rgba(239,68,68,0.2)' }}>
          <h2 style={{ fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)', fontSize: 16, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>Danger Zone</h2>
          <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 16 }}>Your data belongs to you. Always. Download it anytime, no strings attached.</p>
          <button className="btn-ghost" style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
            onClick={() => toast('Account deletion coming soon — contact support', { icon: '⚠️' })}>
            Delete account
          </button>
        </div>
      </motion.div>
    </div>
  )
}
