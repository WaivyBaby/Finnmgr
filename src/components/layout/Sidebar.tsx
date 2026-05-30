'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'

const NAV = [
  { href: '/dashboard',     label: 'Dashboard',    icon: '📊' },
  { href: '/clients',       label: 'Clients',      icon: '👥' },
  { href: '/invoices',      label: 'Invoices',     icon: '🧾' },
  { href: '/income',        label: 'Income',       icon: '💰' },
  { href: '/expenses',      label: 'Expenses',     icon: '🧮' },
  { href: '/vault',         label: 'Documents',    icon: '📁' },
  { href: '/budget',        label: 'Budget',       icon: '🎯' },
  { href: '/cashflow',      label: 'Cash Flow',    icon: '📈' },
  { href: '/tax',           label: 'Tax',          icon: '📋' },
  { href: '/reports',       label: 'Reports',      icon: '📉' },
]

const BOTTOM_NAV = [
  { href: '/settings',      label: 'Settings',     icon: '⚙️' },
]

export default function Sidebar({ userEmail, userName }: { userEmail: string; userName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initials = userName ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '?'

  return (
    <aside className="glass-nav" style={{ width: 220, display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0, position: 'relative', zIndex: 10 }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--bd)' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 14, fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)' }}>F</span>
          </div>
          <span className="nav-brand" style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.04em' }}>FINNMGR</span>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 10, marginBottom: 2,
                textDecoration: 'none', fontSize: 13, fontWeight: active ? 600 : 500,
                color: active ? '#6366f1' : 'var(--mu)',
                background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 15 }}>{icon}</span>
              {label}
              {active && (
                <motion.div layoutId="active-pill" style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '10px 8px 16px', borderTop: '1px solid var(--bd)' }}>
        {BOTTOM_NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 10, marginBottom: 2,
              textDecoration: 'none', fontSize: 13, fontWeight: 500,
              color: 'var(--mu)', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 15 }}>{icon}</span>
            {label}
          </Link>
        ))}

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '8px 10px', borderRadius: 10, marginBottom: 2,
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, color: 'var(--mu)', transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 15 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginTop: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: 'white', fontSize: 10, fontWeight: 800 }}>{initials}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName || userEmail}</p>
            <button onClick={signOut} style={{ fontSize: 10, color: 'var(--mu)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
