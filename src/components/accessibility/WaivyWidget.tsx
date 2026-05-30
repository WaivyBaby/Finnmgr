'use client'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const STORAGE_KEY = 'finnmgr_a11y'

type A11yState = {
  fontSize: boolean
  lineHeight: boolean
  letterSpacing: boolean
  dyslexiaFont: boolean
  highContrast: boolean
  monochrome: boolean
  invertColors: boolean
  highlightLinks: boolean
  readingGuide: boolean
  reducedMotion: boolean
  skipNav: boolean
}

const DEFAULTS: A11yState = {
  fontSize: false,
  lineHeight: false,
  letterSpacing: false,
  dyslexiaFont: false,
  highContrast: false,
  monochrome: false,
  invertColors: false,
  highlightLinks: false,
  readingGuide: false,
  reducedMotion: false,
  skipNav: false,
}

const CLASS_MAP: Record<keyof A11yState, string> = {
  fontSize:      'a11y-font-size',
  lineHeight:    'a11y-line-height',
  letterSpacing: 'a11y-letter-spacing',
  dyslexiaFont:  'a11y-dyslexia-font',
  highContrast:  'a11y-high-contrast',
  monochrome:    'a11y-monochrome',
  invertColors:  'a11y-invert',
  highlightLinks:'a11y-highlight-links',
  readingGuide:  'a11y-reading-guide',
  reducedMotion: 'a11y-reduced-motion',
  skipNav:       'a11y-skip-nav',
}

const TOGGLES: { key: keyof A11yState; label: string; icon: string }[] = [
  { key: 'fontSize',       label: 'Larger Text',       icon: 'A+' },
  { key: 'lineHeight',     label: 'Line Height',        icon: '☰' },
  { key: 'letterSpacing',  label: 'Letter Spacing',     icon: 'A Z' },
  { key: 'dyslexiaFont',   label: 'Dyslexia Font',      icon: 'Dd' },
  { key: 'highContrast',   label: 'High Contrast',      icon: '◑' },
  { key: 'monochrome',     label: 'Monochrome',         icon: '⬛' },
  { key: 'invertColors',   label: 'Invert Colors',      icon: '⊙' },
  { key: 'highlightLinks', label: 'Highlight Links',    icon: '🔗' },
  { key: 'readingGuide',   label: 'Reading Guide',      icon: '▬' },
  { key: 'reducedMotion',  label: 'Reduce Motion',      icon: '⏸' },
  { key: 'skipNav',        label: 'Skip Navigation',    icon: '↷' },
]

function applyClasses(state: A11yState) {
  const root = document.documentElement
  Object.entries(CLASS_MAP).forEach(([key, cls]) => {
    const k = key as keyof A11yState
    if (state[k]) root.classList.add(cls)
    else root.classList.remove(cls)
  })
}

export default function WaivyWidget() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<A11yState>(DEFAULTS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = { ...DEFAULTS, ...JSON.parse(saved) }
        setState(parsed)
        applyClasses(parsed)
      }
    } catch {}
  }, [])

  function toggle(key: keyof A11yState) {
    setState(prev => {
      const next = { ...prev, [key]: !prev[key] }
      applyClasses(next)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function reset() {
    setState(DEFAULTS)
    applyClasses(DEFAULTS)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  if (!mounted) return null

  const anyActive = Object.values(state).some(Boolean)

  return (
    <>
      {/* Global a11y styles */}
      <style>{`
        .a11y-font-size { font-size: 118% !important; }
        .a11y-line-height * { line-height: 1.9 !important; }
        .a11y-letter-spacing * { letter-spacing: 0.12em !important; }
        .a11y-dyslexia-font, .a11y-dyslexia-font * { font-family: 'Comic Sans MS', 'OpenDyslexic', cursive !important; letter-spacing: 0.05em !important; }
        .a11y-high-contrast { filter: contrast(1.5) !important; }
        .a11y-monochrome { filter: grayscale(1) !important; }
        .a11y-invert { filter: invert(1) hue-rotate(180deg) !important; }
        .a11y-highlight-links a { background: #ffff00 !important; color: #000 !important; outline: 2px solid #000 !important; border-radius: 2px; }
        .a11y-reduced-motion *, .a11y-reduced-motion *::before, .a11y-reduced-motion *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        .a11y-skip-nav::before { content: 'Skip to main content'; position: fixed; top: 12px; left: 50%; transform: translateX(-50%); background: #6366f1; color: white; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; z-index: 9999; }
        .a11y-reading-guide::after { content: ''; position: fixed; left: 0; right: 0; height: 2px; background: rgba(99,102,241,0.6); pointer-events: none; z-index: 9998; top: var(--reading-guide-y, 50%); }
      `}</style>

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Accessibility options"
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: anyActive
            ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
            : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          border: anyActive ? '2px solid #fff' : '2px solid transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
          zIndex: 500,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        ♿
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 498 }}
            />
            <motion.div
              initial={{ opacity: 0, x: -20, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'fixed',
                bottom: 84,
                left: 24,
                width: 260,
                background: 'var(--bg2)',
                border: '1px solid var(--bd2)',
                borderRadius: 18,
                boxShadow: '0 16px 60px rgba(0,0,0,0.35)',
                zIndex: 499,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>Accessibility</p>
                  <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 1 }}>Customize your experience</p>
                </div>
                {anyActive && (
                  <button onClick={reset} style={{ fontSize: 10, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    Reset all
                  </button>
                )}
              </div>

              {/* Toggles */}
              <div style={{ padding: '8px 10px', maxHeight: 360, overflowY: 'auto' }}>
                {TOGGLES.map(({ key, label, icon }) => {
                  const active = state[key]
                  return (
                    <button
                      key={key}
                      onClick={() => toggle(key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '9px 10px',
                        borderRadius: 10,
                        border: 'none',
                        background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        marginBottom: 2,
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: active ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--bg3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: active ? '#fff' : 'var(--mu)',
                        transition: 'all 0.15s',
                      }}>
                        {icon}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: active ? '#6366f1' : 'var(--ink)', flex: 1, textAlign: 'left' }}>
                        {label}
                      </span>
                      {/* Toggle pill */}
                      <div style={{
                        width: 32, height: 18, borderRadius: 99,
                        background: active ? '#6366f1' : 'var(--bg4)',
                        position: 'relative', flexShrink: 0,
                        transition: 'background 0.2s',
                      }}>
                        <div style={{
                          position: 'absolute', top: 3, left: active ? 16 : 3,
                          width: 12, height: 12, borderRadius: '50%',
                          background: '#fff', transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 18px', borderTop: '1px solid var(--bd)', textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: 'var(--mu2)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  Waivy ✦ FINNMGR
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
