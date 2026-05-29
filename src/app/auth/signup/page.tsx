'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', business: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name, business_name: form.business } },
    })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.4,0,0.2,1] }} style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 900, fontSize: 16 }}>F</span>
            </div>
            <span style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 900, fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.04em' }}>FINNMGR</span>
          </Link>
          <h1 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 26, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.035em' }}>Create your account</h1>
          <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Start managing your finances today</p>
        </div>

        <div className="glass-card" style={{ padding: 32 }}>
          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, color: '#ef4444' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {[
                { key: 'name', label: 'Your Name', placeholder: 'Jane Smith', type: 'text' },
                { key: 'business', label: 'Business Name', placeholder: 'Acme Studio', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input className="input" type={f.type} required placeholder={f.placeholder}
                    value={(form as Record<string,string>)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Email</label>
              <input className="input" type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Password</label>
              <input className="input" type="password" required minLength={6} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min. 6 characters" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, borderRadius: 12 }}>
              {loading ? 'Creating account...' : 'Create account →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--mu)', marginTop: 24, fontSize: 13 }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
