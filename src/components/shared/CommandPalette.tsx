'use client'
import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const ACTIONS = [
  { id: 'dashboard',   label: 'Go to Dashboard',   icon: '📊', path: '/dashboard' },
  { id: 'invoices',    label: 'New Invoice',        icon: '🧾', path: '/invoices/new' },
  { id: 'income',      label: 'Add Income',         icon: '💰', path: '/income' },
  { id: 'expense',     label: 'Add Expense',        icon: '🧾', path: '/expenses' },
  { id: 'clients',     label: 'View Clients',       icon: '👥', path: '/clients' },
  { id: 'vault',       label: 'Document Vault',     icon: '📁', path: '/vault' },
  { id: 'budget',      label: 'Budget Planner',     icon: '🎯', path: '/budget' },
  { id: 'cashflow',    label: 'Cash Flow',          icon: '📈', path: '/cashflow' },
  { id: 'tax',         label: 'Tax Prep',           icon: '🧮', path: '/tax' },
  { id: 'reports',     label: 'Reports',            icon: '📋', path: '/reports' },
  { id: 'settings',    label: 'Settings',           icon: '⚙️', path: '/settings' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(p => !p) }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function go(path: string) { router.push(path); setOpen(false); setQuery('') }

  const filtered = ACTIONS.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-backdrop"
            style={{ zIndex: 999 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -16 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: '540px', zIndex: 1000,
              background: 'var(--bg2)', borderRadius: '16px',
              border: '1px solid var(--bd2)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
              overflow: 'hidden',
            }}
          >
            <Command>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
                <span style={{ color: 'var(--mu2)', fontSize: 16 }}>🔍</span>
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search or jump to..."
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    fontSize: 14, color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif',
                  }}
                />
                <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: 'var(--bg3)', color: 'var(--mu)', border: '1px solid var(--bd2)' }}>ESC</kbd>
              </div>
              <Command.List style={{ padding: '8px', maxHeight: 360, overflowY: 'auto' }}>
                <Command.Empty style={{ textAlign: 'center', padding: '24px', color: 'var(--mu)', fontSize: 13 }}>
                  No results found.
                </Command.Empty>
                <Command.Group>
                  {filtered.map(action => (
                    <Command.Item
                      key={action.id}
                      value={action.label}
                      onSelect={() => go(action.path)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                        fontSize: 13, color: 'var(--ink)', transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                        {action.icon}
                      </div>
                      {action.label}
                      <span style={{ marginLeft: 'auto', color: 'var(--mu2)', fontSize: 12 }}>→</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 14, fontSize: 10, color: 'var(--mu2)' }}>
                <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
                <span style={{ marginLeft: 'auto' }}>⌘K to open</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
