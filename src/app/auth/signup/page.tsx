'use client'
/*
 * SIGNUP PAGE
 * - Does NOT manually insert into profiles — the database trigger handle_new_user() handles that.
 * - If email confirmation is required (Supabase default), shows a "check your email" message.
 * - If email confirmation is disabled (Supabase dashboard > Authentication > Settings),
 *   redirects directly to /dashboard.
 * - To disable email confirmation for development:
 *   Supabase Dashboard → Authentication → Settings → "Enable email confirmations" → OFF
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'

function friendlyError(msg: string): string {
  if (msg.toLowerCase().includes('user already registered') || msg.toLowerCase().includes('already registered'))
    return 'An account with this email already exists. Sign in instead.'
  if (msg.toLowerCase().includes('password should be at least') || msg.toLowerCase().includes('password must be'))
    return 'Password must be at least 6 characters.'
  if (msg.toLowerCase().includes('database error') || msg.toLowerCase().includes('unexpected error'))
    return 'Something went wrong on our end. Please try again in a moment.'
  if (msg.toLowerCase().includes('invalid email'))
    return 'Please enter a valid email address.'
  if (msg.toLowerCase().includes('email rate limit') || msg.toLowerCase().includes('too many requests'))
    return 'Too many attempts. Please wait a minute before trying again.'
  return msg
}

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', business: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()

    // Call signUp — the database trigger auto-creates the profile row.
    // Do NOT manually insert into profiles here.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.name,
          business_name: form.business,
        },
      },
    })

    if (signUpError) {
      setError(friendlyError(signUpError.message))
      setLoading(false)
      return
    }

    // If session exists immediately, email confirmation is disabled → go to dashboard
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    // If user exists but no session, Supabase requires email confirmation
    if (data.user && !data.session) {
      setEmailSent(true)
      setLoading(false)
      return
    }

    // Fallback — shouldn't reach here, but safe redirect
    setLoading(false)
    router.push('/dashboard')
  }

  // Email confirmation sent state
  if (emailSent) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
          <h1 style={{ fontFamily: `Cabinet Grotesk, sans-serif`, fontSize: 26, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.035em', marginBottom: 12 }}>
            Check your email
          </h1>
          <p style={{ color: 'var(--mu)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
            We sent a confirmation link to <strong style={{ color: 'var(--ink)' }}>{form.email}</strong>.
            Click the link in that email to activate your account, then sign in.
          </p>
          <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
            <p style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--ink)' }}>No email?</strong> Check your spam folder. If you still don&apos;t see it, try signing up again or contact support.
            </p>
          </div>
          <Link href="/auth/login" style={{ color: '#6366f1', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            Go to sign in →
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.4,0,0.2,1] }} style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontFamily: `Cabinet Grotesk, sans-serif`, fontWeight: 900, fontSize: 16 }}>F</span>
            </div>
            <span style={{ fontFamily: `Cabinet Grotesk, sans-serif`, fontWeight: 900, fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.04em' }}>FINNMGR</span>
          </Link>
          <h1 style={{ fontFamily: `Cabinet Grotesk, sans-serif`, fontSize: 26, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.035em' }}>Create your account</h1>
          <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Start managing your finances today</p>
        </div>

        <div className="glass-card" style={{ padding: 32 }}>
          {error && (
            <div role="alert" style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderLeft: '4px solid #ef4444', borderRadius: 10, fontSize: 13, color: '#ef4444', lineHeight: 1.6 }}>
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
                  <label htmlFor={`signup-${f.key}`} style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input
                    id={`signup-${f.key}`}
                    className="input"
                    type={f.type}
                    required
                    placeholder={f.placeholder}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="signup-email" style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Email</label>
              <input
                id="signup-email"
                className="input"
                type="email"
                required
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label htmlFor="signup-password" style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Password</label>
              <input
                id="signup-password"
                className="input"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Min. 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, borderRadius: 12, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                  Creating account...
                </span>
              ) : 'Create account →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--mu)', marginTop: 24, fontSize: 13 }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
        </p>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
