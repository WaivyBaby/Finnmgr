'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const STORAGE_KEY = 'finnmgr_a11y'

/* ── State shape ─────────────────────────────────────────────────────────── */
type A11yState = {
  fontSize: number          // 70–200 in 10 steps, 100 = default
  lineHeight: boolean
  letterSpacing: boolean
  wordSpacing: boolean
  dyslexia: boolean
  alignLeft: boolean
  alignCenter: boolean
  alignRight: boolean
  highContrast: boolean
  monochrome: boolean
  invert: boolean
  satLow: boolean
  satHigh: boolean
  highlightLinks: boolean
  highlightHeadings: boolean
  hideBackground: boolean
  cursorLarge: boolean
  focusStrong: boolean
  readingGuide: boolean
  pauseAnim: boolean
  reducedMotion: boolean
  screenReader: boolean
  skipNav: boolean
}

const DEFAULTS: A11yState = {
  fontSize: 100,
  lineHeight: false, letterSpacing: false, wordSpacing: false,
  dyslexia: false,
  alignLeft: false, alignCenter: false, alignRight: false,
  highContrast: false, monochrome: false, invert: false,
  satLow: false, satHigh: false,
  highlightLinks: false, highlightHeadings: false, hideBackground: false,
  cursorLarge: false, focusStrong: false,
  readingGuide: false, pauseAnim: false, reducedMotion: false,
  screenReader: false, skipNav: false,
}

/* ── Apply state → DOM classes ───────────────────────────────────────────── */
function applyState(s: A11yState) {
  const cl = document.documentElement.classList

  // Font size — remove all, add current if not 100
  for (let p = 70; p <= 200; p += 10) cl.remove(`a11y-font-${p}`)
  if (s.fontSize !== 100) cl.add(`a11y-font-${s.fontSize}`)

  const map: [boolean, string][] = [
    [s.lineHeight,        'a11y-line-height'],
    [s.letterSpacing,     'a11y-letter-spacing'],
    [s.wordSpacing,       'a11y-word-spacing'],
    [s.dyslexia,          'a11y-dyslexia'],
    [s.alignLeft,         'a11y-align-left'],
    [s.alignCenter,       'a11y-align-center'],
    [s.alignRight,        'a11y-align-right'],
    [s.highContrast,      'a11y-high-contrast'],
    [s.monochrome,        'a11y-monochrome'],
    [s.invert,            'a11y-invert'],
    [s.satLow,            'a11y-sat-low'],
    [s.satHigh,           'a11y-sat-high'],
    [s.highlightLinks,    'a11y-highlight-links'],
    [s.highlightHeadings, 'a11y-highlight-headings'],
    [s.hideBackground,    'a11y-hide-images'],
    [s.cursorLarge,       'a11y-cursor-large'],
    [s.focusStrong,       'a11y-focus-strong'],
    [s.readingGuide,      'a11y-reading-guide'],
    [s.pauseAnim,         'a11y-pause-anim'],
    [s.reducedMotion,     'a11y-reduced-motion'],
  ]
  map.forEach(([active, cls]) => active ? cl.add(cls) : cl.remove(cls))

  // Screen reader hint (aria-live region)
  let srEl = document.getElementById('finnmgr-sr-region')
  if (s.screenReader && !srEl) {
    srEl = document.createElement('div')
    srEl.id = 'finnmgr-sr-region'
    srEl.setAttribute('aria-live', 'polite')
    srEl.setAttribute('aria-atomic', 'true')
    Object.assign(srEl.style, { position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' })
    document.body.appendChild(srEl)
  } else if (!s.screenReader && srEl) {
    srEl.remove()
  }

  // Skip nav link
  let skipEl = document.getElementById('finnmgr-skip-link')
  if (s.skipNav && !skipEl) {
    const anchor = document.createElement('a') as HTMLAnchorElement
    anchor.id = 'finnmgr-skip-link'
    anchor.href = '#main-content'
    anchor.className = 'a11y-skip-link'
    anchor.textContent = 'Skip to main content'
    document.body.prepend(anchor)
    skipEl = anchor
  } else if (!s.skipNav && skipEl) {
    skipEl.remove()
  }
}

/* ── Count active features ───────────────────────────────────────────────── */
function countActive(s: A11yState): number {
  let n = s.fontSize !== 100 ? 1 : 0
  const bools: (keyof A11yState)[] = [
    'lineHeight','letterSpacing','wordSpacing','dyslexia',
    'alignLeft','alignCenter','alignRight',
    'highContrast','monochrome','invert','satLow','satHigh',
    'highlightLinks','highlightHeadings','hideBackground',
    'cursorLarge','focusStrong',
    'readingGuide','pauseAnim','reducedMotion',
    'screenReader','skipNav',
  ]
  bools.forEach(k => { if (s[k]) n++ })
  return n
}

/* ── Toggle row ─────────────────────────────────────────────────────────── */
function Toggle({ label, active, onToggle, desc }: { label: string; active: boolean; onToggle: () => void; desc?: string }) {
  return (
    <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 10, padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ width: 36, height: 20, borderRadius: 99, background: active ? '#6366f1' : 'var(--bg4)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: 3, left: active ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: active ? '#6366f1' : 'var(--ink)', margin: 0 }}>{label}</p>
        {desc && <p style={{ fontSize: 10, color: 'var(--mu)', margin: '1px 0 0', lineHeight: 1.4 }}>{desc}</p>}
      </div>
    </button>
  )
}

/* ── Section wrapper ─────────────────────────────────────────────────────── */
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--bd)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', gap: 10 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--ink)', textAlign: 'left' }}>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--mu)', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 16px 14px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function WaivyWidget() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<A11yState>(DEFAULTS)
  const [mounted, setMounted] = useState(false)
  const guideRef = useRef<HTMLDivElement | null>(null)
  const maskTopRef = useRef<HTMLDivElement | null>(null)
  const maskBotRef = useRef<HTMLDivElement | null>(null)

  /* Load from localStorage */
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: A11yState = { ...DEFAULTS, ...JSON.parse(saved) }
        setState(parsed)
        applyState(parsed)
      }
    } catch {}
  }, [])

  /* Alt+A shortcut */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  /* Reading guide mouse tracking */
  useEffect(() => {
    if (!state.readingGuide) return
    // Inject guide elements once
    if (!guideRef.current) {
      const line = document.createElement('div')
      line.className = 'reading-guide-line'
      const top = document.createElement('div')
      top.className = 'reading-guide-mask-top'
      const bot = document.createElement('div')
      bot.className = 'reading-guide-mask-bottom'
      document.body.appendChild(line)
      document.body.appendChild(top)
      document.body.appendChild(bot)
      guideRef.current = line
      maskTopRef.current = top
      maskBotRef.current = bot
    }
    const onMove = (e: MouseEvent) => {
      const y = e.clientY
      if (guideRef.current) guideRef.current.style.top = `${y}px`
      if (maskTopRef.current) { maskTopRef.current.style.top = '0'; maskTopRef.current.style.height = `${y - 20}px` }
      if (maskBotRef.current) { maskBotRef.current.style.top = `${y + 20}px`; maskBotRef.current.style.bottom = '0'; maskBotRef.current.style.height = `${window.innerHeight - y - 20}px` }
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [state.readingGuide])

  /* Cleanup guide elements when disabled */
  useEffect(() => {
    if (!state.readingGuide) {
      guideRef.current?.remove(); guideRef.current = null
      maskTopRef.current?.remove(); maskTopRef.current = null
      maskBotRef.current?.remove(); maskBotRef.current = null
    }
  }, [state.readingGuide])

  /* Update state helper */
  const update = useCallback((patch: Partial<A11yState>) => {
    setState(prev => {
      const next = { ...prev, ...patch }
      applyState(next)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const toggle = useCallback((key: keyof A11yState) => {
    update({ [key]: !state[key] } as Partial<A11yState>)
  }, [state, update])

  const reset = useCallback(() => {
    applyState(DEFAULTS)
    setState(DEFAULTS)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  /* Font stepper */
  const stepFont = (dir: 1 | -1) => {
    const next = Math.max(70, Math.min(200, state.fontSize + dir * 10))
    update({ fontSize: next })
  }

  if (!mounted) return null
  const activeCount = countActive(state)

  // Detect mobile (JS-side, after mount)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  const panelStyle: React.CSSProperties = isMobile ? {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: 'var(--bg2)', border: '1px solid var(--bd2)',
    borderRadius: '18px 18px 0 0', boxShadow: '0 -10px 60px rgba(0,0,0,0.4)',
    zIndex: 9001, overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
  } : {
    position: 'fixed', bottom: 84, left: 24, width: 300,
    background: 'var(--bg2)', border: '1px solid var(--bd2)',
    borderRadius: 18, boxShadow: '0 20px 70px rgba(0,0,0,0.4)',
    zIndex: 9001, overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
  }

  const mobilePanelAnim = isMobile
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
    : { initial: { opacity: 0, x: -20, scale: 0.95 }, animate: { opacity: 1, x: 0, scale: 1 }, exit: { opacity: 0, x: -20, scale: 0.95 } }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Accessibility options (Alt+A)"
        style={{
          position: 'fixed', bottom: 24, left: 24,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          border: activeCount > 0 ? '2.5px solid #fff' : '2.5px solid transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
          zIndex: 9000, animation: 'wavy-pulse 3s infinite',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.12)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
      >
        ♿
        {/* White dot badge when ANY feature active */}
        {activeCount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 8, height: 8, borderRadius: '50%',
            background: '#fff', boxShadow: '0 0 0 2px rgba(99,102,241,0.5)',
          }} />
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 8999 }} />
            <motion.div
              {...mobilePanelAnim}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={panelStyle}
            >
              {/* Header */}
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>Accessibility</p>
                  <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 1 }}>
                    {activeCount > 0 ? `${activeCount} feature${activeCount > 1 ? 's' : ''} active` : 'Alt+A to toggle'}
                  </p>
                </div>
                {activeCount > 0 && (
                  <button onClick={reset} style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, background: 'rgba(99,102,241,0.08)', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>
                    Reset all
                  </button>
                )}
              </div>

              {/* Scrollable sections */}
              <div style={{ overflowY: 'auto', flex: 1 }}>

                {/* ── 1. Text & Readability ── */}
                <Section title="Text & Readability" icon="📝">
                  {/* Font size stepper */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Font Size</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => stepFont(-1)} disabled={state.fontSize <= 70}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--bd2)', background: 'var(--bg3)', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        −
                      </button>
                      <span style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 14, color: state.fontSize !== 100 ? '#6366f1' : 'var(--ink)' }}>{state.fontSize}%</span>
                      <button onClick={() => stepFont(1)} disabled={state.fontSize >= 200}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--bd2)', background: 'var(--bg3)', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        +
                      </button>
                    </div>
                    {/* Named presets */}
                    <div style={{ marginTop: 10, display: 'flex', gap: 5 }}>
                      {([
                        { label: 'Small', size: 90 },
                        { label: 'Default', size: 100 },
                        { label: 'Large', size: 120 },
                        { label: 'XL', size: 140 },
                      ] as const).map(p => (
                        <button key={p.label} onClick={() => update({ fontSize: p.size })}
                          style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s', background: state.fontSize === p.size ? '#6366f1' : 'var(--bg3)', color: state.fontSize === p.size ? '#fff' : 'var(--mu)' }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Toggle label="Increased Line Height" active={state.lineHeight} onToggle={() => toggle('lineHeight')} desc="1.5x → 2.0x spacing" />
                  <Toggle label="Letter Spacing" active={state.letterSpacing} onToggle={() => toggle('letterSpacing')} desc="Adds 0.08em between letters" />
                  <Toggle label="Word Spacing" active={state.wordSpacing} onToggle={() => toggle('wordSpacing')} desc="Adds 0.25em between words" />
                  <Toggle label="Dyslexia Font (Lexend)" active={state.dyslexia} onToggle={() => toggle('dyslexia')} desc="Switches body text to Lexend" />
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Text Alignment</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['Left', 'Center', 'Right'] as const).map(a => {
                        const key = `align${a}` as keyof A11yState
                        return (
                          <button key={a} onClick={() => update({ alignLeft: false, alignCenter: false, alignRight: false, [key]: !state[key] })}
                            style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: state[key] ? '#6366f1' : 'var(--bg3)', color: state[key] ? '#fff' : 'var(--mu)' }}>
                            {a === 'Left' ? '⇤' : a === 'Center' ? '⇔' : '⇥'} {a}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </Section>

                {/* ── 2. Contrast & Visual ── */}
                <Section title="Contrast & Visual" icon="🎨">
                  <Toggle label="High Contrast" active={state.highContrast} onToggle={() => toggle('highContrast')} desc="filter: contrast(1.6)" />
                  <Toggle label="Monochrome" active={state.monochrome} onToggle={() => toggle('monochrome')} desc="Removes all color" />
                  <Toggle label="Invert Colors" active={state.invert} onToggle={() => toggle('invert')} desc="Inverts display + hue rotates" />
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Saturation</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => update({ satLow: !state.satLow, satHigh: false })}
                        style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: state.satLow ? '#6366f1' : 'var(--bg3)', color: state.satLow ? '#fff' : 'var(--mu)' }}>
                        Low 30%
                      </button>
                      <button onClick={() => update({ satHigh: !state.satHigh, satLow: false })}
                        style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: state.satHigh ? '#6366f1' : 'var(--bg3)', color: state.satHigh ? '#fff' : 'var(--mu)' }}>
                        High 200%
                      </button>
                    </div>
                  </div>
                  <Toggle label="Highlight Links & Buttons" active={state.highlightLinks} onToggle={() => toggle('highlightLinks')} desc="Amber outline on interactive elements" />
                  <Toggle label="Highlight Headings" active={state.highlightHeadings} onToggle={() => toggle('highlightHeadings')} desc="Indigo left border on h1–h4" />
                  <Toggle label="Hide Background FX" active={state.hideBackground} onToggle={() => toggle('hideBackground')} desc="Removes mesh, orbs, and noise" />
                </Section>

                {/* ── 3. Navigation ── */}
                <Section title="Navigation" icon="🧭">
                  <Toggle label="Large Cursor" active={state.cursorLarge} onToggle={() => toggle('cursorLarge')} desc="Bigger custom cursor" />
                  <Toggle label="Enhanced Focus Ring" active={state.focusStrong} onToggle={() => toggle('focusStrong')} desc="3px indigo ring on all :focus" />
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Keyboard Shortcuts</p>
                    {[['Alt+A', 'Toggle this panel'], ['Cmd+K', 'Command palette'], ['Esc', 'Close modals/panels']].map(([key, desc]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <code style={{ fontSize: 10, background: 'var(--bg4)', padding: '2px 6px', borderRadius: 4, color: '#6366f1', fontWeight: 700 }}>{key}</code>
                        <span style={{ fontSize: 10, color: 'var(--mu)' }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* ── 4. Cognitive ── */}
                <Section title="Cognitive" icon="🧠">
                  <Toggle label="Reading Guide" active={state.readingGuide} onToggle={() => toggle('readingGuide')} desc="Line follows your mouse cursor" />
                  <Toggle label="Pause Animations" active={state.pauseAnim} onToggle={() => toggle('pauseAnim')} desc="Freezes all CSS animations" />
                  <Toggle label="Reduced Motion" active={state.reducedMotion} onToggle={() => toggle('reducedMotion')} desc="0ms duration on all transitions" />
                </Section>

                {/* ── 5. Structural ── */}
                <Section title="Structural" icon="🏗️">
                  <Toggle label="Screen Reader Mode" active={state.screenReader} onToggle={() => toggle('screenReader')} desc="Injects aria-live announcement region" />
                  <Toggle label="Skip Navigation" active={state.skipNav} onToggle={() => toggle('skipNav')} desc="Adds skip-to-content link on Tab" />
                </Section>
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bd)', textAlign: 'center', flexShrink: 0 }}>
                <p style={{ fontSize: 9, color: 'var(--mu2)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  Waivy ✦ FINNMGR — Making finance accessible for everyone
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
