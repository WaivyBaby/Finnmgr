'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/clients',   label: 'Clients',   icon: '👥' },
  { href: '/invoices',  label: 'Invoices',  icon: '🧾' },
  { href: '/income',    label: 'Income',    icon: '💰' },
  { href: '/expenses',  label: 'Expenses',  icon: '🧮' },
  { href: '/vault',     label: 'Documents', icon: '📁' },
  { href: '/budget',    label: 'Budget',    icon: '🎯' },
  { href: '/cashflow',  label: 'Cash Flow', icon: '📈' },
  { href: '/tax',       label: 'Tax',       icon: '📋' },
  { href: '/reports',   label: 'Reports',   icon: '📉' },
]

const BOTTOM_NAV = [
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar({ userEmail, userName }: { userEmail: string; userName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  function closeDrawer() { setDrawerOpen(false) }

  return (
    <>
      {/* ── Desktop / Tablet sidebar ── */}
      <aside
        className="glass-nav desktop-sidebar"
        style={{ width: 220, display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0, position: 'relative', zIndex: 10 }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--bd)' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: 'white', fontWeight: 900, fontSize: 14, fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)' }}>F</span>
            </div>
            <span className="nav-brand" style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.04em' }}>FINNMGR</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav" style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className="nav-link"
                data-label={label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 10, marginBottom: 2,
                  textDecoration: 'none', fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? '#6366f1' : 'var(--mu)',
                  background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
                <span className="nav-label">{label}</span>
                {/* Tooltip shown on tablet hover via CSS */}
                <span className="nav-tooltip">{label}</span>
                {active && (
                  <motion.div
                    layoutId="active-pill"
                    className="active-dot"
                    style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }}
                  />
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
              className="nav-link"
              data-label={label}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 10, marginBottom: 2,
                textDecoration: 'none', fontSize: 13, fontWeight: 500,
                color: 'var(--mu)', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
              <span className="nav-label">{label}</span>
              <span className="nav-tooltip">{label}</span>
            </Link>
          ))}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="nav-link"
            data-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 10px', borderRadius: 10, marginBottom: 2,
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, color: 'var(--mu)', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 15, flexShrink: 0 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="nav-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            <span className="nav-tooltip">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>

          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginTop: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: 'white', fontSize: 10, fontWeight: 800 }}>{initials}</span>
            </div>
            <div className="sidebar-user-text" style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName || userEmail}</p>
              <button
                onClick={signOut}
                style={{ fontSize: 10, color: 'var(--mu)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile header bar (shown at ≤767px via CSS, position:fixed so out of flex flow) ── */}
      <header className="mobile-header">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 5 }}
        >
          <span style={{ display: 'block', width: 22, height: 2, background: 'var(--ink)', borderRadius: 2 }} />
          <span style={{ display: 'block', width: 22, height: 2, background: 'var(--ink)', borderRadius: 2 }} />
          <span style={{ display: 'block', width: 22, height: 2, background: 'var(--ink)', borderRadius: 2 }} />
        </button>

        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 12, fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)' }}>F</span>
          </div>
          <span className="nav-brand" style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.04em' }}>FINNMGR</span>
        </Link>

        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontSize: 11, fontWeight: 800 }}>{initials}</span>
        </div>
      </header>

      {/* ── Mobile drawer overlay ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200 }}
            />

            {/* Left panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'fixed', top: 0, left: 0, bottom: 0,
                width: 280, background: 'var(--bg2)',
                borderRight: '1px solid var(--bd2)',
                zIndex: 201, display: 'flex', flexDirection: 'column',
                boxShadow: '20px 0 60px rgba(0,0,0,0.3)',
              }}
            >
              {/* Drawer header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
                <Link
                  href="/dashboard"
                  onClick={closeDrawer}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontWeight: 900, fontSize: 12, fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)' }}>F</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.04em', fontFamily: 'Cabinet Grotesk, sans-serif' }}>FINNMGR</span>
                </Link>
                <button
                  onClick={closeDrawer}
                  aria-label="Close menu"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 24, lineHeight: 1, padding: 4 }}
                >
                  ×
                </button>
              </div>

              {/* Nav links */}
              <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
                {NAV.map(({ href, label, icon }) => {
                  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={closeDrawer}
                      className={`mobile-nav-link${active ? ' active' : ''}`}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                      {label}
                    </Link>
                  )
                })}
              </nav>

              {/* Drawer bottom: settings + theme + user */}
              <div style={{ padding: '8px 10px', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
                {BOTTOM_NAV.map(({ href, label, icon }) => (
                  <Link key={href} href={href} onClick={closeDrawer} className="mobile-nav-link">
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                    {label}
                  </Link>
                ))}

                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="mobile-nav-link"
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>

                {/* User row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 8px', borderTop: '1px solid var(--bd)', marginTop: 4 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'white', fontSize: 12, fontWeight: 800 }}>{initials}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName || userEmail}</p>
                    <button
                      onClick={() => { closeDrawer(); signOut() }}
                      style={{ fontSize: 11, color: 'var(--mu)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginTop: 1 }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
