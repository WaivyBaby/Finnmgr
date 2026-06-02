'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'

function friendlyError(msg: string): string {
  if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('invalid credentials'))
    return 'Incorrect email or password. Please try again.'
  if (msg.toLowerCase().includes('email not confirmed'))
    return 'Please confirm your email address before signing in. Check your inbox.'
  if (msg.toLowerCase().includes('too many requests') || msg.toLowerCase().includes('rate limit'))
    return 'Too many sign-in attempts. Please wait a minute and try again.'
  if (msg.toLowerCase().includes('user not found'))
    return 'No account found with that email. Sign up to create one.'
  return msg
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(friendlyError(signInError.message))
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.4,0,0.2,1] }} style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontFamily: `Cabinet Grotesk, sans-serif`, fontWeight: 900, fontSize: 16 }}>F</span>
            </div>
            <span style={{ fontFamily: `Cabinet Grotesk, sans-serif`, fontWeight: 900, fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.04em' }}>FINNMGR</span>
          </Link>
          <h1 style={{ fontFamily: `Cabinet Grotesk, sans-serif`, fontSize: 26, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.035em' }}>Welcome back</h1>
          <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Sign in to your account</p>
        </div>

        <div className="glass-card" style={{ padding: 32 }}>
          {error && (
            <div role="alert" style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderLeft: '4px solid #ef4444', borderRadius: 10, fontSize: 13, color: '#ef4444', lineHeight: 1.6 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="login-email" style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Email</label>
              <input
                id="login-email"
                className="input"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label htmlFor="login-password" style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Password</label>
              <input
                id="login-password"
                className="input"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
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
                  Signing in...
                </span>
              ) : 'Sign in →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--mu)', marginTop: 24, fontSize: 13 }}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" style={{ color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>Sign up free</Link>
        </p>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
