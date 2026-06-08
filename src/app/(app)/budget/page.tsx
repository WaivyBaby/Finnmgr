'use client'
/*
 * FINANCIAL PLANNING CENTER — Budget Command Center
 * Migration: supabase/migrations/budget_command_center.sql
 * Actuals pulled from real expenses table. Budget_actuals kept for backward compat.
 * Font names with spaces: template literals or double-quoted strings only.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import CountUp from 'react-countup'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type BudgetCat = {
  id: string; name: string; icon: string; color: string; monthly_limit: number
  sort_order: number; description?: string; alert_threshold?: number
  linked_expense_category?: string; notes?: string; period?: string
  rollover?: boolean; user_id?: string
}
type BudgetActual = { category_id: string; spent: number; month: number; year: number }
type Expense = { id: string; date: string; amount: number; category: string; vendor: string; is_deductible: boolean; is_subscription?: boolean; subscription_period?: string }
type IncomeRow  = { amount: number; date: string }

/* ─── Constants ──────────────────────────────────────────────────────────── */
const EXPENSE_CATS = ['Operations','Software','Marketing','Payroll','Office','Travel','Meals','Equipment','Professional Services','Insurance','Rent','Utilities','Other']
const ICONS = ['💼','💻','📢','📱','✈️','🍽️','🏥','📚','🎯','🏠','⚡','🎨','🛒','💰','🔧','🏦','📦','🚗']
const COLORS = ['#6366f1','#10b981','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#ff7043','#14b8a6']

const STARTER_TEMPLATES: Record<string, { name: string; icon: string; color: string; monthly_limit: number }[]> = {
  'Service Business': [
    { name: 'Software', icon: '💻', color: '#6366f1', monthly_limit: 200 },
    { name: 'Marketing', icon: '📢', color: '#10b981', monthly_limit: 300 },
    { name: 'Professional Services', icon: '💼', color: '#0ea5e9', monthly_limit: 200 },
    { name: 'Office', icon: '🏠', color: '#f59e0b', monthly_limit: 100 },
    { name: 'Travel', icon: '✈️', color: '#8b5cf6', monthly_limit: 150 },
    { name: 'Meals', icon: '🍽️', color: '#ec4899', monthly_limit: 100 },
  ],
  'E-commerce': [
    { name: 'Inventory', icon: '📦', color: '#6366f1', monthly_limit: 1500 },
    { name: 'Marketing', icon: '📢', color: '#10b981', monthly_limit: 500 },
    { name: 'Shipping', icon: '🚗', color: '#0ea5e9', monthly_limit: 300 },
    { name: 'Software', icon: '💻', color: '#f59e0b', monthly_limit: 150 },
    { name: 'Operations', icon: '🔧', color: '#8b5cf6', monthly_limit: 200 },
  ],
  'Consultant': [
    { name: 'Software', icon: '💻', color: '#6366f1', monthly_limit: 300 },
    { name: 'Professional Services', icon: '💼', color: '#10b981', monthly_limit: 300 },
    { name: 'Travel', icon: '✈️', color: '#0ea5e9', monthly_limit: 400 },
    { name: 'Marketing', icon: '📢', color: '#f59e0b', monthly_limit: 200 },
    { name: 'Meals', icon: '🍽️', color: '#8b5cf6', monthly_limit: 150 },
  ],
  'Freelancer': [
    { name: 'Software', icon: '💻', color: '#6366f1', monthly_limit: 150 },
    { name: 'Marketing', icon: '📢', color: '#10b981', monthly_limit: 100 },
    { name: 'Office', icon: '🏠', color: '#0ea5e9', monthly_limit: 50 },
    { name: 'Equipment', icon: '🔧', color: '#f59e0b', monthly_limit: 100 },
    { name: 'Professional Services', icon: '💼', color: '#8b5cf6', monthly_limit: 100 },
  ],
}

const DEFAULT_CAT_FORM = {
  name: '', icon: '💼', color: '#6366f1', monthly_limit: '',
  description: '', alert_threshold: 80, linked_expense_category: '',
  notes: '', period: 'monthly', rollover: false,
}

/* ─── Utilities ──────────────────────────────────────────────────────────── */
function fmt$(n: number, dec = 2) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}

/* ─── InfoIcon ───────────────────────────────────────────────────────────── */
function InfoIcon({ tip }: { tip: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
      <button type="button"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)}
        style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--bd2)', color: 'var(--mu)', fontSize: 9, cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>
        i
      </button>
      {show && (
        <span role="tooltip" style={{ position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: 'var(--ink)', lineHeight: 1.6, width: 200, zIndex: 99, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', pointerEvents: 'none', whiteSpace: 'normal', fontWeight: 400 }}>
          {tip}
        </span>
      )}
    </span>
  )
}

/* ─── Category Drawer ────────────────────────────────────────────────────── */
function CategoryDrawer({
  open, onClose, onSaved, editItem, userId, sortOrder,
}: {
  open: boolean; onClose: () => void; onSaved: (c: BudgetCat) => void
  editItem: BudgetCat | null; userId: string; sortOrder: number
}) {
  const [form, setForm] = useState({ ...DEFAULT_CAT_FORM })
  const [saving, setSaving] = useState(false)
  const isEdit = !!editItem

  useEffect(() => {
    if (!open) return
    setForm(isEdit && editItem ? {
      name: editItem.name, icon: editItem.icon, color: editItem.color,
      monthly_limit: String(editItem.monthly_limit),
      description: editItem.description ?? '',
      alert_threshold: editItem.alert_threshold ?? 80,
      linked_expense_category: editItem.linked_expense_category ?? '',
      notes: editItem.notes ?? '', period: editItem.period ?? 'monthly',
      rollover: editItem.rollover ?? false,
    } : { ...DEFAULT_CAT_FORM })
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, isEdit, editItem, onClose])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.monthly_limit) { toast.error('Name and budget amount required'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      ...form, monthly_limit: parseFloat(form.monthly_limit),
      linked_expense_category: form.linked_expense_category || null,
      description: form.description || null, notes: form.notes || null,
    }
    if (isEdit && editItem) {
      const { data, error } = await sb.from('budget_categories').update(payload).eq('id', editItem.id).select().single()
      setSaving(false)
      if (error) { toast.error('Failed to save'); return }
      toast.success('Category updated ✓'); onSaved(data as BudgetCat); onClose()
    } else {
      const { data, error } = await sb.from('budget_categories').insert({ user_id: userId, ...payload, sort_order: sortOrder }).select().single()
      setSaving(false)
      if (error) { toast.error('Failed to add'); return }
      toast.success('Category added ✓'); onSaved(data as BudgetCat); onClose()
    }
  }

  const iStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }
  const lStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block' }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 799 }} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="side-drawer-panel"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
              <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{isEdit ? 'Edit Category' : 'Add Budget Category'}</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={submit} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Category Name *</label>
                  <input style={iStyle} required placeholder="Software, Marketing…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={lStyle}>Monthly Budget ($) *</label>
                  <div style={{ position: 'relative', marginTop: 6 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 13 }}>$</span>
                    <input style={{ ...iStyle, marginTop: 0, paddingLeft: 26 }} type="number" min="0" step="0.01" required value={form.monthly_limit} onChange={e => setForm(f => ({ ...f, monthly_limit: e.target.value }))} placeholder="500" />
                  </div>
                </div>
                <div>
                  <label style={lStyle}>Alert Threshold (%)</label>
                  <input style={iStyle} type="number" min="1" max="100" value={form.alert_threshold} onChange={e => setForm(f => ({ ...f, alert_threshold: parseFloat(e.target.value) || 80 }))} />
                </div>
                <div>
                  <label style={lStyle}>Icon</label>
                  <select style={iStyle} value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}>
                    {ICONS.map(i => <option key={i} value={i}>{i} {i}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Period</label>
                  <select style={iStyle} value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Link to Expense Category (optional)</label>
                  <select style={iStyle} value={form.linked_expense_category} onChange={e => setForm(f => ({ ...f, linked_expense_category: e.target.value }))}>
                    <option value="">Use category name to match</option>
                    {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>Links this budget line to actual expenses from the Expenses module.</p>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Description (optional)</label>
                  <input style={iStyle} placeholder="What this category covers…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Notes</label>
                  <textarea style={{ ...iStyle, height: 68, resize: 'none', lineHeight: 1.6 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)', minHeight: 44 }}>
                    <input type="checkbox" checked={form.rollover} onChange={e => setForm(f => ({ ...f, rollover: e.target.checked }))} />
                    Roll over unused budget to next month
                  </label>
                </div>
              </div>
            </form>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 10 }}>
              <button onClick={submit as unknown as React.MouseEventHandler} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '13px 20px', fontSize: 14 }}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Category'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '13px 20px' }}>Cancel</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Build My Budget Wizard ─────────────────────────────────────────────── */
function BuildBudgetWizard({
  open, onClose, onSave, userId, expenses, sortCount,
}: {
  open: boolean; onClose: () => void
  onSave: (cats: Omit<BudgetCat, 'id' | 'user_id'>[]) => Promise<void>
  userId: string; expenses: Expense[]; sortCount: number
}) {
  const [step, setStep] = useState(1)
  const [period, setPeriod] = useState<'monthly'|'quarterly'|'annual'>('monthly')
  const [strategy, setStrategy] = useState<'conservative'|'balanced'|'growth'>('balanced')
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof STARTER_TEMPLATES | null>(null)
  const [suggested, setSuggested] = useState<{ name: string; icon: string; color: string; monthly_limit: number; include: boolean }[]>([])
  const [saving, setSaving] = useState(false)

  const multipliers = { conservative: 0.85, balanced: 1.0, growth: 1.2 }

  useEffect(() => {
    if (!open) { setStep(1); setSelectedTemplate(null) }
  }, [open])

  function buildSuggestions() {
    const mult = multipliers[strategy]
    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const recentExpenses = expenses.filter(e => new Date(e.date) >= threeMonthsAgo)

    if (recentExpenses.length < 3 && !selectedTemplate) {
      // Not enough data — user must pick a template
      setStep(2)
      return
    }

    let items: { name: string; icon: string; color: string; monthly_limit: number; include: boolean }[] = []

    if (selectedTemplate && STARTER_TEMPLATES[selectedTemplate]) {
      items = STARTER_TEMPLATES[selectedTemplate].map(t => ({ ...t, include: true }))
    } else {
      // Build from expense history
      const catAmounts: Record<string, number> = {}
      recentExpenses.forEach(e => { catAmounts[e.category] = (catAmounts[e.category] ?? 0) + Number(e.amount) })
      const catAvgMonthly = Object.entries(catAmounts)
        .map(([cat, total]) => ({ cat, monthly: (total / 3) * mult }))
        .filter(c => c.monthly > 0)
        .sort((a, b) => b.monthly - a.monthly)
      items = catAvgMonthly.slice(0, 10).map((c, idx) => ({
        name: c.cat, icon: ICONS[idx % ICONS.length], color: COLORS[idx % COLORS.length],
        monthly_limit: Math.ceil(c.monthly / 50) * 50, // round to nearest 50
        include: true,
      }))
    }

    setSuggested(items)
    setStep(3)
  }

  async function saveBudget() {
    setSaving(true)
    const toSave = suggested.filter(s => s.include).map((s, i) => ({
      name: s.name, icon: s.icon, color: s.color, monthly_limit: s.monthly_limit,
      sort_order: sortCount + i, period: 'monthly', alert_threshold: 80, rollover: false,
    }))
    if (toSave.length === 0) { toast.error('Select at least one category'); setSaving(false); return }
    await onSave(toSave)
    setSaving(false)
    onClose()
  }

  if (!open) return null

  const hasEnoughData = expenses.filter(e => {
    const d = new Date(e.date); const now = new Date()
    return d >= new Date(now.getFullYear(), now.getMonth() - 3, 1)
  }).length >= 3

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 799 }} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="side-drawer-panel"
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Build My Budget</h3>
            <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Step {step} of {hasEnoughData ? 3 : 3}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <AnimatePresence mode="wait">

            {/* Step 1: Period + Strategy */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h4 style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginBottom: 16 }}>Choose your planning period</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {(['monthly','quarterly','annual'] as const).map(p => (
                    <button key={p} type="button" onClick={() => setPeriod(p)}
                      style={{ padding: '14px 16px', borderRadius: 12, border: `2px solid ${period === p ? '#6366f1' : 'var(--bd)'}`, background: period === p ? 'rgba(99,102,241,0.08)' : 'var(--bg3)', cursor: 'pointer', textAlign: 'left' }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{p.charAt(0).toUpperCase() + p.slice(1)}</p>
                      <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{{ monthly: 'Plan month-by-month — ideal for most businesses.', quarterly: 'Plan in 3-month blocks — good for seasonal businesses.', annual: 'Full-year plan — use alongside monthly tracking.' }[p]}</p>
                    </button>
                  ))}
                </div>

                <h4 style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginBottom: 16 }}>Choose a budget strategy</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {([
                    { key: 'conservative', label: 'Conservative', desc: '15% below your historical average. Builds cash reserves.', color: '#10b981' },
                    { key: 'balanced',     label: 'Balanced',     desc: 'Match your historical average. Steady and predictable.', color: '#6366f1' },
                    { key: 'growth',       label: 'Growth Mode',  desc: '20% above average. Invest in growth with guardrails.', color: '#f59e0b' },
                  ] as const).map(s => (
                    <button key={s.key} type="button" onClick={() => setStrategy(s.key)}
                      style={{ padding: '14px 16px', borderRadius: 12, border: `2px solid ${strategy === s.key ? s.color : 'var(--bd)'}`, background: strategy === s.key ? `${s.color}10` : 'var(--bg3)', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{s.label}</p>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--mu)' }}>{s.desc}</p>
                    </button>
                  ))}
                </div>

                {!hasEnoughData && (
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>Not enough expense data</p>
                    <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>You need at least 3 months of expenses for auto-suggestions. In the next step, choose a starter template.</p>
                  </div>
                )}

                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px' }} onClick={() => setStep(2)}>
                  Next →
                </button>
              </motion.div>
            )}

            {/* Step 2: Template selection (if no expense data) OR data confirmation */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {!hasEnoughData ? (
                  <>
                    <h4 style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>Choose a starter template</h4>
                    <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 16, lineHeight: 1.6 }}>We don&apos;t have enough expense history yet. Pick a template that matches your business type.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {Object.keys(STARTER_TEMPLATES).map(t => (
                        <button key={t} type="button" onClick={() => setSelectedTemplate(t as keyof typeof STARTER_TEMPLATES)}
                          style={{ padding: '14px 16px', borderRadius: 12, border: `2px solid ${selectedTemplate === t ? '#6366f1' : 'var(--bd)'}`, background: selectedTemplate === t ? 'rgba(99,102,241,0.08)' : 'var(--bg3)', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{t}</p>
                            <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{STARTER_TEMPLATES[t as keyof typeof STARTER_TEMPLATES].length} categories</p>
                          </div>
                          {selectedTemplate === t && <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 13 }}>✓</span>}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                      <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>← Back</button>
                      <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!selectedTemplate} onClick={buildSuggestions}>
                        Review Budget →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>Analysis ready</h4>
                    <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 20, lineHeight: 1.6 }}>FINNMGR will analyze your last 3 months of expenses and suggest budgets using your <strong>{strategy}</strong> strategy.</p>
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg3)', marginBottom: 20 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Based on your expense history</p>
                      <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.6 }}>
                        Expense data from the last 3 months will be averaged and adjusted using the {strategy} multiplier ({(multipliers[strategy] * 100).toFixed(0)}%) to create suggested category budgets.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>← Back</button>
                      <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={buildSuggestions}>Generate Budget →</button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Step 3: Review & save */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h4 style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>Review your budget</h4>
                <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 16 }}>Uncheck categories you don&apos;t need. You can edit amounts after saving.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {suggested.map((s, i) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: s.include ? 'var(--bg3)' : 'rgba(0,0,0,0.03)', border: `1px solid ${s.include ? 'var(--bd)' : 'transparent'}`, opacity: s.include ? 1 : 0.5 }}>
                      <input type="checkbox" checked={s.include} onChange={e => setSuggested(prev => prev.map((x, j) => j === i ? { ...x, include: e.target.checked } : x))} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                      <span style={{ fontSize: 18 }}>{s.icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</p>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 12 }}>$</span>
                        <input type="number" min="0" value={s.monthly_limit}
                          onChange={e => setSuggested(prev => prev.map((x, j) => j === i ? { ...x, monthly_limit: parseFloat(e.target.value) || 0 } : x))}
                          style={{ width: 90, padding: '6px 8px 6px 20px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 8, fontSize: 13, color: 'var(--in-txt)', outline: 'none' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>Total monthly budget: {fmt$(suggested.filter(s => s.include).reduce((sum, s) => sum + s.monthly_limit, 0))}</p>
                  <p style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>{suggested.filter(s => s.include).length} categories selected</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(hasEnoughData ? 2 : 2)}>← Back</button>
                  <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving} onClick={saveBudget}>
                    {saving ? 'Saving…' : 'Save Budget ✓'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function BudgetPage() {
  const router = useRouter()
  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const [cats, setCats]         = useState<BudgetCat[]>([])
  const [actuals, setActuals]   = useState<BudgetActual[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [income, setIncome]     = useState<IncomeRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState('')

  const [drawerOpen, setDrawerOpen]   = useState(false)
  const [editCat, setEditCat]         = useState<BudgetCat | null>(null)
  const [wizardOpen, setWizardOpen]   = useState(false)
  const [exportOpen, setExportOpen]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [catsRes, actualsRes, expRes, incRes] = await Promise.all([
      sb.from('budget_categories').select('*').eq('user_id', user.id).order('sort_order'),
      sb.from('budget_actuals').select('*').eq('user_id', user.id).eq('month', month).eq('year', year),
      sb.from('expenses').select('id,date,amount,category,vendor,is_deductible,is_subscription,subscription_period').eq('user_id', user.id),
      sb.from('income').select('amount,date').eq('user_id', user.id),
    ])
    setCats(catsRes.data ?? [])
    setActuals(actualsRes.data ?? [])
    setExpenses(expRes.data ?? [])
    setIncome(incRes.data ?? [])
    setLoading(false)
  }, [month, year])

  useEffect(() => { load() }, [load])

  /* ════════════════════════════════════════════════════════════════════
     CENTRALISED COMPUTED DATA
  ════════════════════════════════════════════════════════════════════ */
  const d = useMemo(() => {
    const monthStart    = new Date(year, month - 1, 1)
    const prevStart     = new Date(year, month - 2, 1)
    const prevEnd       = new Date(year, month - 1, 0, 23, 59, 59)
    const threeMonthsAgo = new Date(year, month - 4, 1)
    const daysElapsed   = now.getDate()
    const daysInMonth   = new Date(year, month, 0).getDate()

    /* ── Spending this month from expenses ── */
    const thisMonthExp  = expenses.filter(e => new Date(e.date) >= monthStart)
    const prevMonthExp  = expenses.filter(e => { const d = new Date(e.date); return d >= prevStart && d <= prevEnd })
    const thisCatSpend: Record<string, number> = {}
    thisMonthExp.forEach(e => { thisCatSpend[e.category] = (thisCatSpend[e.category] ?? 0) + Number(e.amount) })

    /* ── Per-category actuals — prefer expenses, fallback to budget_actuals ── */
    function getActual(cat: BudgetCat): number {
      const matchKey = cat.linked_expense_category || cat.name
      const fromExpenses = thisCatSpend[matchKey] ?? 0
      const fromActuals  = actuals.find(a => a.category_id === cat.id)?.spent ?? 0
      return Math.max(fromExpenses, fromActuals)
    }

    const catsWithActuals = cats.map(cat => {
      const actual    = getActual(cat)
      const budget    = Number(cat.monthly_limit)
      const remaining = Math.max(0, budget - actual)
      const pct       = budget > 0 ? Math.min(100, (actual / budget) * 100) : 0
      const threshold = cat.alert_threshold ?? 80
      const status    = actual > budget ? 'over' : pct >= threshold ? 'watch' : pct >= 50 ? 'on-track' : 'under'
      return { ...cat, actual, budget, remaining, pct, status }
    })

    const totalBudget    = cats.reduce((s, c) => s + Number(c.monthly_limit), 0)
    const totalSpent     = catsWithActuals.reduce((s, c) => s + c.actual, 0)
    const totalRemaining = Math.max(0, totalBudget - totalSpent)
    const overBudgetCats = catsWithActuals.filter(c => c.status === 'over')
    const watchCats      = catsWithActuals.filter(c => c.status === 'watch')

    /* ── Projected month end spend ── */
    const dailyBurnRate     = daysElapsed > 0 ? totalSpent / daysElapsed : 0
    const projectedMonthEnd = dailyBurnRate * daysInMonth
    const projectedOverUnder = projectedMonthEnd - totalBudget

    /* ── Income + profit ── */
    const currentMonthRevenue = income.filter(i => new Date(i.date) >= monthStart).reduce((s, i) => s + Number(i.amount), 0)
    const totalIncome         = income.reduce((s, i) => s + Number(i.amount), 0)
    const totalExpAll         = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const profitMargin        = totalIncome > 0 ? ((totalIncome - totalExpAll) / totalIncome) * 100 : 0
    const netProfit           = totalIncome - totalExpAll

    /* ── Cash runway ── */
    const recentThreeMonthsExp = expenses.filter(e => new Date(e.date) >= threeMonthsAgo).reduce((s, e) => s + Number(e.amount), 0)
    const avgMonthlyExpenses   = recentThreeMonthsExp > 0 ? recentThreeMonthsExp / 3 : totalExpAll > 0 ? totalExpAll / 6 : 0
    const netCash              = totalIncome - totalExpAll
    const cashRunwayMonths     = avgMonthlyExpenses > 0 ? Math.max(0, netCash / avgMonthlyExpenses) : 0

    /* ── MoM expense growth ── */
    const prevTotal  = prevMonthExp.reduce((s, e) => s + Number(e.amount), 0)
    const currTotal  = thisMonthExp.reduce((s, e) => s + Number(e.amount), 0)
    const expGrowth  = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : currTotal > 0 ? 100 : 0

    /* ── Subscriptions ── */
    const vendorMonths: Record<string, { months: Set<string>; amounts: number[]; cat: string }> = {}
    expenses.forEach(e => {
      const key = e.vendor.toLowerCase().trim()
      if (!vendorMonths[key]) vendorMonths[key] = { months: new Set(), amounts: [], cat: e.category }
      vendorMonths[key].months.add(e.date.substring(0, 7))
      vendorMonths[key].amounts.push(Number(e.amount))
      vendorMonths[key].cat = e.category
    })
    const detectedSubs = Object.entries(vendorMonths)
      .filter(([_, v]) => v.months.size >= 2 || v.amounts.some((_, i, a) => i > 0 && Math.abs(a[i] - a[i-1]) / Math.max(a[i-1], 1) < 0.05))
      .map(([vendor, v]) => {
        const avg = v.amounts.reduce((s, a) => s + a, 0) / v.amounts.length
        const cv  = avg > 0 ? Math.sqrt(v.amounts.map(a => (a - avg) ** 2).reduce((s, x) => s + x, 0) / v.amounts.length) / avg : 1
        return { vendor, monthlyAvg: avg, months: v.months.size, cat: v.cat, consistency: cv }
      })
      .filter(s => s.consistency < 0.25)
      .sort((a, b) => b.monthlyAvg - a.monthlyAvg).slice(0, 8)
    const subTotal = detectedSubs.reduce((s, x) => s + x.monthlyAvg, 0)
    const subPctOfBudget = totalBudget > 0 ? subTotal / totalBudget * 100 : 0

    /* ── Savings opportunities ── */
    const savings: { title: string; detail: string; value: number; icon: string }[] = []
    if (overBudgetCats.length > 0) {
      const overAmt = overBudgetCats.reduce((s, c) => s + (c.actual - c.budget), 0)
      savings.push({ icon: '📉', title: 'Over-budget categories', detail: `${overBudgetCats.map(c => c.name).join(', ')} exceeded budget by a total of ${fmt$(overAmt)}.`, value: overAmt })
    }
    if (subTotal > 0 && subPctOfBudget > 25) {
      savings.push({ icon: '📱', title: 'Subscription audit', detail: `${detectedSubs.length} services at ${fmt$(subTotal)}/mo. Auditing could save 15–20%.`, value: subTotal * 0.18 * 12 })
    }
    if (expGrowth > 20) {
      savings.push({ icon: '📈', title: 'Expense spike this month', detail: `Expenses grew ${expGrowth.toFixed(0)}% vs last month. Review the largest categories.`, value: 0 })
    }
    const unusedBudget = catsWithActuals.filter(c => c.pct < 10 && c.budget > 100)
    if (unusedBudget.length > 0) {
      const unusedAmt = unusedBudget.reduce((s, c) => s + c.remaining, 0)
      savings.push({ icon: '💡', title: 'Unused budget categories', detail: `${unusedBudget.length} categories have <10% usage. Reallocate ${fmt$(unusedAmt)} to higher-priority areas.`, value: unusedAmt })
    }

    /* ── Business Health Score (budget-focused) ── */
    let healthScore = 65
    // Budget adherence
    const adherence = cats.length > 0 ? catsWithActuals.filter(c => c.status !== 'over').length / cats.length : 1
    healthScore += Math.round(adherence * 15) - 5
    // Cash runway
    if (cashRunwayMonths > 6)      healthScore += 12
    else if (cashRunwayMonths > 3) healthScore += 6
    else if (cashRunwayMonths < 1 && income.length > 0) healthScore -= 15
    // Profit margin
    if (profitMargin > 40)         healthScore += 8
    else if (profitMargin < 10 && income.length > 2) healthScore -= 10
    // MoM expense growth
    if (expGrowth > 30)            healthScore -= 12
    else if (expGrowth > 15)       healthScore -= 6
    else if (expGrowth < 0)        healthScore += 5
    // Over-budget categories
    healthScore -= Math.min(20, overBudgetCats.length * 7)
    // Subscription load
    if (subPctOfBudget > 40)       healthScore -= 8
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))
    const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Healthy' : healthScore >= 40 ? 'Watch Closely' : 'At Risk'
    const healthColor = healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#0ea5e9' : healthScore >= 40 ? '#f59e0b' : '#ef4444'

    /* ── Budget Calendar (upcoming recurring payments) ── */
    const subscriptionExpenses = expenses.filter(e => e.is_subscription)
    const upcomingPayments = subscriptionExpenses
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 8)
      .map(e => {
        const lastDate = new Date(e.date)
        const nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate())
        return { vendor: e.vendor, amount: Number(e.amount), date: nextDate, category: e.category, period: e.subscription_period ?? 'monthly' }
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    return {
      catsWithActuals, totalBudget, totalSpent, totalRemaining,
      overBudgetCats, watchCats, projectedMonthEnd, projectedOverUnder,
      currentMonthRevenue, totalIncome, totalExpAll, profitMargin, netProfit,
      avgMonthlyExpenses, cashRunwayMonths, netCash,
      expGrowth, detectedSubs, subTotal, subPctOfBudget,
      savings, healthScore, healthLabel, healthColor,
      upcomingPayments, daysElapsed, daysInMonth, adherence,
    }
  }, [cats, actuals, expenses, income, month, year, now])

  /* ── Budget Coach insights ── */
  const coachInsights = useMemo(() => {
    const list: { icon: string; title: string; msg: string; why: string; action?: string; priority: 'high'|'medium'|'low' }[] = []
    if (cats.length === 0) return list
    const { projectedOverUnder, projectedMonthEnd, totalBudget, daysElapsed, daysInMonth, overBudgetCats, watchCats, subTotal, subPctOfBudget, cashRunwayMonths, expGrowth, profitMargin, adherence } = d

    if (overBudgetCats.length > 0)
      list.push({ icon: '🚨', title: 'Over Budget', msg: `${overBudgetCats.map(c => c.name).join(', ')} has exceeded its budget this month.`, why: 'Overspending erodes profit and can cascade into cash flow issues.', action: 'Review expenses', priority: 'high' })

    if (projectedOverUnder < -100)
      list.push({ icon: '✅', title: 'On Track to Finish Under Budget', msg: `At current pace, you will end the month ${fmt$(Math.abs(projectedOverUnder))} under budget.`, why: 'This is a positive signal — consider reallocating surplus to growth.', priority: 'low' })
    else if (projectedOverUnder > 200 && daysElapsed > 5)
      list.push({ icon: '⚠️', title: 'Projected to Exceed Budget', msg: `At current pace, you will end ${fmt$(projectedOverUnder)} over budget.`, why: 'Course-correct now — it is easier early in the month.', action: 'Adjust spending', priority: 'high' })

    if (watchCats.length > 0 && watchCats.length <= 3)
      list.push({ icon: '👀', title: `${watchCats.length} Category${watchCats.length > 1 ? 'ies' : 'y'} Approaching Limit`, msg: `${watchCats.map(c => `${c.name} (${c.pct.toFixed(0)}%)`).join(', ')} are near their limit with ${daysInMonth - daysElapsed} days remaining.`, why: 'Categories at 80%+ with half the month left often overshoot.', priority: 'medium' })

    if (subTotal > 0 && subPctOfBudget > 20)
      list.push({ icon: '📱', title: 'Subscriptions = ' + subPctOfBudget.toFixed(0) + '% of Budget', msg: `${fmt$(subTotal)}/mo in detected subscriptions consuming ${subPctOfBudget.toFixed(0)}% of your budget.`, why: 'Subscription costs are sticky — audit regularly.', action: 'Review subscriptions', priority: 'medium' })

    if (cashRunwayMonths > 0)
      list.push({ icon: '🏦', title: `${cashRunwayMonths.toFixed(1)} Months of Runway`, msg: `At current burn rate, you have ${cashRunwayMonths.toFixed(1)} months of operational runway.`, why: 'Keep runway above 3 months as a safety buffer.', priority: cashRunwayMonths > 3 ? 'low' : cashRunwayMonths > 1 ? 'medium' : 'high' })

    if (expGrowth > 20)
      list.push({ icon: '📈', title: `Expenses Up ${expGrowth.toFixed(0)}% This Month`, msg: `Spending is growing faster than expected.`, why: 'Fast expense growth that outpaces revenue compresses margins.', action: 'Review categories', priority: 'medium' })

    if (adherence < 0.8 && cats.length > 3)
      list.push({ icon: '🎯', title: 'Budget Adherence Low', msg: `${Math.round(adherence * 100)}% of categories within budget. Review over-budget categories.`, why: 'Low adherence signals systemic spending issues, not one-off events.', priority: 'medium' })

    return list.slice(0, 5)
  }, [cats, d])

  /* ── Export ── */
  function exportCsv(rows: Record<string, unknown>[], filename: string) {
    if (!rows.length) { toast.error('No data to export'); return }
    const h = Object.keys(rows[0])
    const csv = [h.join(','), ...rows.map(r => h.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = filename; a.click()
    toast.success(`${filename} exported ✓`); setExportOpen(false)
  }
  const exportBudget     = () => exportCsv(d.catsWithActuals.map(c => ({ category: c.name, budget: c.budget, spent: c.actual, remaining: c.remaining, pct: c.pct.toFixed(1) + '%', status: c.status })), 'budget_vs_actual.csv')
  const exportCategories = () => exportCsv(cats.map(c => ({ name: c.name, monthly_limit: c.monthly_limit, period: c.period ?? 'monthly' })), 'budget_categories.csv')
  const exportSubs       = () => exportCsv(d.detectedSubs.map(s => ({ vendor: s.vendor, monthly: s.monthlyAvg.toFixed(2), annual: (s.monthlyAvg * 12).toFixed(2), category: s.cat })), 'subscriptions.csv')
  const exportSavings    = () => exportCsv(d.savings.map(s => ({ opportunity: s.title, detail: s.detail, value: s.value.toFixed(2) })), 'savings_opportunities.csv')

  /* ── Category CRUD ── */
  async function removeCat(id: string) {
    if (!window.confirm('Delete this budget category?')) return
    const sb = createClient()
    await sb.from('budget_categories').delete().eq('id', id)
    setCats(prev => prev.filter(c => c.id !== id))
    toast.success('Category removed')
  }

  async function buildBudgetSave(cats: Omit<BudgetCat, 'id' | 'user_id'>[]) {
    const sb = createClient()
    const { error } = await sb.from('budget_categories').insert(cats.map(c => ({ ...c, user_id: userId })))
    if (error) { toast.error('Failed to save budget'); return }
    toast.success(`Budget saved! ${cats.length} categories created.`)
    load()
  }

  const iStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit' }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 44, width: 280, marginBottom: 28 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          {[...Array(8)].map((_, i) => <div key={i} style={{ height: 100 }} className="skeleton" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} style={{ height: 200, marginBottom: 20 }} className="skeleton" />)}
      </div>
    )
  }

  const barColor = (pct: number, threshold: number) => pct >= 100 ? '#ef4444' : pct >= threshold ? '#f59e0b' : '#10b981'
  const statusConfig = {
    over:     { label: 'Over Budget',  bg: 'rgba(239,68,68,0.1)',   color: '#ef4444' },
    watch:    { label: 'Watch',        bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
    'on-track': { label: 'On Track',   bg: 'rgba(14,165,233,0.1)', color: '#0ea5e9' },
    under:    { label: 'Under Budget', bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
  }

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ══ HEADER ══ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Budget Planner</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Plan spending, protect profit, and stay ahead of your business cash needs.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-primary" style={{ minHeight: 44 }} onClick={() => { setEditCat(null); setDrawerOpen(true) }}>+ Add Category</button>
            <button className="btn-ghost" style={{ minHeight: 44 }} onClick={() => setWizardOpen(true)}>⚡ Build My Budget</button>
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" style={{ minHeight: 44 }} onClick={() => setExportOpen(s => !s)}>⬇ Export</button>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ position: 'absolute', top: '110%', right: 0, width: 220, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', zIndex: 40, padding: 8 }}>
                    {[
                      { label: 'Budget vs Actual (CSV)',  fn: exportBudget },
                      { label: 'Category Report (CSV)',   fn: exportCategories },
                      { label: 'Subscription Report (CSV)', fn: exportSubs },
                      { label: 'Savings Opportunities (CSV)', fn: exportSavings },
                      { label: 'PDF Report',              fn: () => { toast('PDF export coming soon 🚀'); setExportOpen(false) } },
                    ].map(x => (
                      <button key={x.label} onClick={x.fn}
                        style={{ display: 'block', width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', textAlign: 'left', borderRadius: 8, fontWeight: 500 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg3)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}>
                        {x.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ══ EMPTY STATE ══ */}
        {cats.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ width: 88, height: 88, borderRadius: 28, background: 'linear-gradient(135deg,rgba(99,102,241,0.14),rgba(139,92,246,0.18))', border: '1.5px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, margin: '0 auto 24px', animation: 'float 3s ease-in-out infinite' }}>
              🎯
            </div>
            <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.035em', marginBottom: 10 }}>Build your first smart budget.</h2>
            <p style={{ fontSize: 14, color: 'var(--mu)', lineHeight: 1.7, maxWidth: 400, margin: '0 auto 28px' }}>
              FINNMGR can help you plan spending, forecast profit, track subscriptions, and protect your cash flow.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-primary" style={{ padding: '13px 28px', fontSize: 14 }} onClick={() => setWizardOpen(true)}>⚡ Build My Budget</button>
              <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => { setEditCat(null); setDrawerOpen(true) }}>+ Add Category</button>
              <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => router.push('/expenses')}>View Expenses</button>
            </div>
          </motion.div>
        )}

        {cats.length > 0 && (
          <>
            {/* ══ 8 KPI CARDS ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Monthly Budget', value: d.totalBudget, prefix: '$', color: '#6366f1', icon: '🎯', tip: 'The total amount you planned to spend this month across all categories.' },
                { label: 'Spent This Month', value: d.totalSpent, prefix: '$', color: d.totalSpent > d.totalBudget ? '#ef4444' : '#ff7043', icon: '💸', sub: d.totalBudget > 0 ? `${Math.min(100, (d.totalSpent / d.totalBudget * 100)).toFixed(0)}% of budget` : undefined, tip: 'Actual expenses recorded so far this month, pulled from your Expenses module.' },
                { label: 'Budget Remaining', value: d.totalRemaining, prefix: '$', color: d.totalRemaining > 0 ? '#10b981' : '#ef4444', icon: '✅', sub: `${d.daysInMonth - d.daysElapsed} days left`, tip: 'How much budget you have left to spend this month.' },
                { label: 'Health Score', value: d.healthScore, prefix: '', suffix: '/100', decimals: 0, color: d.healthColor, icon: '❤️', sub: d.healthLabel, subColor: d.healthColor, tip: '0–100 score based on budget adherence, runway, profit margin, and expense growth.' },
                { label: 'Cash Runway', value: d.cashRunwayMonths, prefix: '', suffix: ' mo', decimals: 1, color: d.cashRunwayMonths > 3 ? '#10b981' : d.cashRunwayMonths > 1 ? '#f59e0b' : '#ef4444', icon: '🏦', tip: "How long your business can operate at current burn rate before cash runs out." },
                { label: 'Profit Margin', value: Math.max(0, d.profitMargin), prefix: '', suffix: '%', decimals: 1, color: d.profitMargin > 30 ? '#10b981' : d.profitMargin > 10 ? '#f59e0b' : '#ef4444', icon: '📊', tip: "How much of your revenue remains after all expenses. 30%+ is healthy for services." },
                { label: 'Month-End Forecast', value: d.projectedMonthEnd, prefix: '$', decimals: 0, color: d.projectedOverUnder > 200 ? '#ef4444' : d.projectedOverUnder > 0 ? '#f59e0b' : '#10b981', icon: '🔮', sub: d.projectedOverUnder !== 0 ? `${d.projectedOverUnder > 0 ? '+' : ''}${fmt$(d.projectedOverUnder, 0)} vs budget` : undefined, subColor: d.projectedOverUnder > 0 ? '#ef4444' : '#10b981', tip: 'Projected spending by month-end based on your current daily burn rate.' },
                { label: 'Savings Opportunity', value: d.savings.reduce((s, x) => s + x.value, 0), prefix: '$', decimals: 0, color: '#8b5cf6', icon: '💡', tip: 'Estimated savings from optimising over-budget categories, subscriptions, and unused budget lines.' },
              ].map((s, i) => (
                <motion.div key={s.label} className="stat-card"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <InfoIcon tip={s.tip} />
                  </div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>
                    {s.prefix}
                    <CountUp end={s.value} decimals={('decimals' in s ? s.decimals as number : s.prefix === '$' ? 2 : 0)} duration={1.2} separator="," />
                    {'suffix' in s && s.suffix}
                  </div>
                  {s.sub && <div className="stat-sub" style={{ color: ('subColor' in s ? s.subColor as string : undefined), marginTop: 4 }}>{s.sub}</div>}
                </motion.div>
              ))}
            </div>

            {/* ══ BUSINESS HEALTH + BUDGET COACH ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Business Health Score */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Business Health</h2>
                  <span style={{ padding: '3px 10px', borderRadius: 99, background: `${d.healthColor}18`, color: d.healthColor, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {d.healthLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                  <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                    <svg viewBox="0 0 90 90" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <circle cx="45" cy="45" r="37" fill="none" stroke="var(--bg3)" strokeWidth="8" />
                      <motion.circle cx="45" cy="45" r="37" fill="none" stroke={d.healthColor} strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 37}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 37 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 37 * (1 - d.healthScore / 100) }}
                        transition={{ duration: 1.3, ease: 'easeOut' }} strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: d.healthColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
                        <CountUp end={d.healthScore} duration={1.3} />
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {[
                      { label: 'Budget Adherence',    val: `${Math.round(d.adherence * 100)}%`, color: d.adherence > 0.8 ? '#10b981' : '#f59e0b' },
                      { label: 'Cash Runway',         val: `${d.cashRunwayMonths.toFixed(1)} mo`, color: d.cashRunwayMonths > 3 ? '#10b981' : '#f59e0b' },
                      { label: 'Profit Margin',       val: `${Math.max(0, d.profitMargin).toFixed(0)}%`, color: d.profitMargin > 30 ? '#10b981' : '#f59e0b' },
                      { label: 'MoM Expense Growth',  val: `${d.expGrowth >= 0 ? '+' : ''}${d.expGrowth.toFixed(0)}%`, color: d.expGrowth <= 10 ? '#10b981' : '#f59e0b' },
                      { label: 'Over-budget Cats',    val: String(d.overBudgetCats.length), color: d.overBudgetCats.length === 0 ? '#10b981' : '#ef4444' },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                        <span style={{ fontSize: 11, color: 'var(--mu)' }}>{f.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: f.color }}>{f.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Budget Coach */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 320px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Budget Coach</h2>
                  <div className="live-dot" />
                </div>
                {coachInsights.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>✅</span>
                    <p style={{ fontSize: 12 }}>Budget is looking healthy. Add more expense data for deeper insights.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {coachInsights.map((ins, i) => {
                      const c = ins.priority === 'high' ? '#ef4444' : ins.priority === 'medium' ? '#f59e0b' : '#10b981'
                      return (
                        <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', borderLeft: `3px solid ${c}` }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>{ins.icon}</span>
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 1 }}>{ins.title}</p>
                              <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>{ins.msg}</p>
                            </div>
                          </div>
                          <p style={{ fontSize: 10, color: 'var(--mu2)', paddingLeft: 22, marginBottom: 4 }}>{ins.why}</p>
                          {ins.action && <button style={{ fontSize: 10, fontWeight: 800, color: c, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 22px' }}>{ins.action} →</button>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ══ BUDGET VS ACTUAL (main section) ══ */}
            <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                    Budget vs Actual — {now.toLocaleString('default', { month: 'long' })} {year}
                  </h2>
                  <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>Actuals pulled from your Expenses module automatically.</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {d.overBudgetCats.length > 0 && <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700 }}>{d.overBudgetCats.length} Over Budget</span>}
                  {d.watchCats.length > 0 && <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 99, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 700 }}>{d.watchCats.length} Watch</span>}
                </div>
              </div>

              {/* Desktop table */}
              <div className="mobile-table-hide">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24 }}>Category</th>
                      <th>Budget</th>
                      <th>Spent</th>
                      <th>Remaining</th>
                      <th style={{ width: 160 }}>Progress</th>
                      <th>Status</th>
                      <th style={{ paddingRight: 20, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.catsWithActuals.map((cat, i) => {
                      const bc  = barColor(cat.pct, cat.alert_threshold ?? 80)
                      const cfg = statusConfig[cat.status as keyof typeof statusConfig]
                      return (
                        <tr key={cat.id} style={{ cursor: 'default' }}>
                          <td style={{ paddingLeft: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 18 }}>{cat.icon}</span>
                              <div>
                                <p style={{ fontWeight: 600, fontSize: 13 }}>{cat.name}</p>
                                {cat.description && <p style={{ fontSize: 10, color: 'var(--mu)' }}>{cat.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{fmt$(cat.budget)}</td>
                          <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 600, color: bc }}>{fmt$(cat.actual)}</td>
                          <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 600, color: cat.remaining > 0 ? '#10b981' : '#ef4444' }}>{cat.remaining > 0 ? fmt$(cat.remaining) : '-' + fmt$(cat.actual - cat.budget)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="progress-track" style={{ flex: 1, height: 6 }}>
                                <motion.div className="progress-fill" initial={{ width: 0 }}
                                  animate={{ width: `${cat.pct}%` }} transition={{ duration: 0.8, delay: i * 0.04 }}
                                  style={{ background: bc }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: bc, minWidth: 32 }}>{cat.pct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 9, padding: '3px 9px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {cfg.label}
                            </span>
                          </td>
                          <td style={{ paddingRight: 20, textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button onClick={() => { setEditCat(cat); setDrawerOpen(true) }} className="btn-ghost" style={{ padding: '4px 9px', fontSize: 11, minHeight: 32 }}>Edit</button>
                              <button onClick={() => router.push('/expenses')} className="btn-ghost" style={{ padding: '4px 9px', fontSize: 11, minHeight: 32 }}>Expenses →</button>
                              <button onClick={() => removeCat(cat.id)} className="btn-ghost" style={{ padding: '4px 9px', fontSize: 11, color: '#ef4444', minHeight: 32 }}>Del</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="mobile-cards">
                {d.catsWithActuals.map((cat, i) => {
                  const bc  = barColor(cat.pct, cat.alert_threshold ?? 80)
                  const cfg = statusConfig[cat.status as keyof typeof statusConfig]
                  return (
                    <motion.div key={cat.id} className="mobile-card" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{cat.icon}</span>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{cat.name}</p>
                            <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 1 }}>{fmt$(cat.actual)} of {fmt$(cat.budget)}</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontWeight: 800, textTransform: 'uppercase' }}>{cfg.label}</span>
                          <p style={{ fontSize: 12, fontWeight: 700, color: bc, marginTop: 4 }}>{cat.pct.toFixed(0)}%</p>
                        </div>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${cat.pct}%`, background: bc, transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => { setEditCat(cat); setDrawerOpen(true) }} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 11, minHeight: 40 }}>Edit</button>
                        <button onClick={() => router.push('/expenses')} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 11, minHeight: 40 }}>View Expenses</button>
                      </div>
                    </motion.div>
                  )
                })}
                <button onClick={() => { setEditCat(null); setDrawerOpen(true) }} className="btn-ghost" style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>+ Add Category</button>
              </div>
            </motion.div>

            {/* ══ PROFIT IMPACT CENTER + CASH RUNWAY ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Profit Impact */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 260px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Profit Impact Center</h2>
                {income.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <p style={{ fontSize: 28, marginBottom: 8 }}>💰</p>
                    <p style={{ fontSize: 12 }}>Add income to see profit impact.</p>
                    <button className="btn-ghost" style={{ marginTop: 12, fontSize: 11 }} onClick={() => router.push('/income')}>Add Income →</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Revenue This Month', val: fmt$(d.currentMonthRevenue), color: '#10b981', icon: '💰', tip: 'Total income recorded this calendar month.' },
                      { label: 'Expenses This Month', val: fmt$(d.totalSpent), color: '#ff7043', icon: '🧮', tip: 'Total expenses from the Expenses module this month.' },
                      { label: 'Net Profit', val: fmt$(d.currentMonthRevenue - d.totalSpent), color: d.currentMonthRevenue - d.totalSpent >= 0 ? '#10b981' : '#ef4444', icon: '📊', tip: 'Revenue minus expenses this month.' },
                      { label: 'Profit Margin', val: d.currentMonthRevenue > 0 ? `${((d.currentMonthRevenue - d.totalSpent) / d.currentMonthRevenue * 100).toFixed(1)}%` : '—', color: d.currentMonthRevenue > 0 && (d.currentMonthRevenue - d.totalSpent) / d.currentMonthRevenue > 0.3 ? '#10b981' : '#f59e0b', icon: '📈', tip: 'How much of revenue you keep after expenses.' },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{r.icon}</span>
                          <span style={{ fontSize: 12, color: 'var(--mu)' }}>{r.label}</span>
                          <InfoIcon tip={r.tip} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: r.color, fontFamily: "DM Mono, monospace" }}>{r.val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Cash Runway + Forecast */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 260px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.49 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Cash Runway & Forecast</h2>
                {expenses.length === 0 && income.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <p style={{ fontSize: 28, marginBottom: 8 }}>🏦</p>
                    <p style={{ fontSize: 12 }}>Add income and expenses to unlock runway forecasting.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ textAlign: 'center', padding: '16px', borderRadius: 14, background: `${d.cashRunwayMonths > 3 ? '#10b981' : d.cashRunwayMonths > 1 ? '#f59e0b' : '#ef4444'}10`, border: `1px solid ${d.cashRunwayMonths > 3 ? '#10b981' : d.cashRunwayMonths > 1 ? '#f59e0b' : '#ef4444'}30`, marginBottom: 14 }}>
                      <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)', marginBottom: 4 }}>Cash Runway</p>
                      <p style={{ fontSize: 28, fontWeight: 900, color: d.cashRunwayMonths > 3 ? '#10b981' : d.cashRunwayMonths > 1 ? '#f59e0b' : '#ef4444', letterSpacing: '-0.04em' }}>
                        <CountUp end={d.cashRunwayMonths} decimals={1} duration={1.2} /> <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--mu)' }}>months</span>
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 4 }}>{fmt$(d.avgMonthlyExpenses, 0)}/mo average burn</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'Expected (on trend)', val: d.projectedMonthEnd, note: 'current pace' },
                        { label: 'Best case (−15%)',    val: d.projectedMonthEnd * 0.85, note: 'spending discipline' },
                        { label: 'Worst case (+15%)',   val: d.projectedMonthEnd * 1.15, note: 'if spending spikes' },
                      ].map(r => (
                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 500 }}>{r.label}</p>
                            <p style={{ fontSize: 10, color: 'var(--mu)' }}>{r.note}</p>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: "DM Mono, monospace" }}>{fmt$(r.val, 0)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            </div>

            {/* ══ SAVINGS OPPORTUNITIES + SUBSCRIPTION CENTER ══ */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Savings Opportunities */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 14 }}>Savings Opportunities</h2>
                {d.savings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>✅</span>
                    <p style={{ fontSize: 12 }}>No savings opportunities detected. Your budget looks optimised.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.savings.map((s, i) => (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--bd)' }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{s.title}</p>
                            <p style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>{s.detail}</p>
                          </div>
                        </div>
                        {s.value > 0 && <p style={{ fontSize: 12, fontWeight: 800, color: '#10b981', paddingLeft: 28 }}>Potential savings: {fmt$(s.value, 0)}</p>}
                      </div>
                    ))}
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 11, fontWeight: 700, color: '#10b981', textAlign: 'center' }}>
                      Total opportunity: {fmt$(d.savings.reduce((s, x) => s + x.value, 0), 0)}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Subscription Center */}
              <motion.div className="glass-card" style={{ padding: 24, flex: '1 1 280px', minWidth: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Subscription Center</h2>
                  {d.subTotal > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mu2)', fontWeight: 800 }}>Monthly</p>
                      <p style={{ fontSize: 14, fontWeight: 900, color: '#f59e0b', fontFamily: "DM Mono, monospace" }}>{fmt$(d.subTotal)}</p>
                    </div>
                  )}
                </div>
                {d.detectedSubs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📱</span>
                    <p style={{ fontSize: 12 }}>No subscriptions detected. Mark recurring expenses in the Expenses module.</p>
                    <button className="btn-ghost" style={{ marginTop: 12, fontSize: 11 }} onClick={() => router.push('/expenses')}>Go to Expenses →</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
                      {d.detectedSubs.slice(0, 6).map(s => (
                        <div key={s.vendor} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: 'var(--bg3)' }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{s.vendor}</p>
                            <p style={{ fontSize: 10, color: 'var(--mu)' }}>{s.cat} · {s.months} months</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#ff7043', fontFamily: "DM Mono, monospace" }}>{fmt$(s.monthlyAvg)}/mo</p>
                            <p style={{ fontSize: 9, color: 'var(--mu2)' }}>{fmt$(s.monthlyAvg * 12, 0)}/yr</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '8px 12px', borderRadius: 10, background: 'var(--bg3)', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--mu)' }}>Annual total</span>
                      <span style={{ fontWeight: 800, color: 'var(--ink)', fontFamily: "DM Mono, monospace" }}>{fmt$(d.subTotal * 12, 0)}</span>
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--mu2)', marginTop: 8, textAlign: 'center' }}>{d.subPctOfBudget.toFixed(0)}% of monthly budget</p>
                  </>
                )}
              </motion.div>
            </div>

            {/* ══ BUDGET CALENDAR ══ */}
            {d.upcomingPayments.length > 0 && (
              <motion.div className="glass-card" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 4 }}>Budget Calendar</h2>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 16 }}>Upcoming recurring payments based on subscription history</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {d.upcomingPayments.map((p, i) => (
                    <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--bd)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{p.vendor}</p>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#ff7043', fontFamily: "DM Mono, monospace" }}>{fmt$(p.amount)}</span>
                      </div>
                      <p style={{ fontSize: 10, color: 'var(--mu)' }}>{p.category} · {p.period}</p>
                      <p style={{ fontSize: 10, color: 'var(--mu2)', marginTop: 3 }}>
                        Expected ~{p.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ══ INTEGRATION READY ══ */}
            <motion.div className="glass-card" style={{ padding: 20, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 4 }}>Connect Your Accounts</h2>
              <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 14 }}>Import transactions automatically from your bank, payroll, and commerce platforms.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                {[
                  { name: 'Plaid', icon: '🏦' }, { name: 'Stripe', icon: '💳' }, { name: 'Square', icon: '◼' },
                  { name: 'Shopify', icon: '🛒' }, { name: 'Gusto', icon: '👥' }, { name: 'QuickBooks', icon: '📚' },
                  { name: 'Xero', icon: '📊' }, { name: 'PayPal', icon: '🅿️' },
                ].map(a => (
                  <button key={a.name} onClick={() => toast(`${a.name} integration coming soon 🚀`)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 8px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg3)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = '1px solid #6366f1' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = '1px solid var(--bd)' }}>
                    <span style={{ fontSize: 18 }}>{a.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>{a.name}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase' }}>Soon</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}

        {/* Mobile FAB */}
        <style>{`
          .budget-fab { display: none; }
          @media (max-width: 767px) {
            .budget-fab { display: flex; position: fixed; bottom: 80px; right: 20px; z-index: 50; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#8b5cf6); border: none; cursor: pointer; align-items: center; justify-content: center; font-size: 24px; color: #fff; box-shadow: 0 8px 24px rgba(99,102,241,0.4); }
          }
        `}</style>
        <button className="budget-fab" onClick={() => { setEditCat(null); setDrawerOpen(true) }}>+</button>
      </motion.div>

      {/* ══ DRAWERS ══ */}
      <CategoryDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditCat(null) }}
        onSaved={cat => { setCats(prev => editCat ? prev.map(c => c.id === cat.id ? cat : c) : [...prev, cat]); setDrawerOpen(false); setEditCat(null) }}
        editItem={editCat}
        userId={userId}
        sortOrder={cats.length}
      />

      <BuildBudgetWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSave={buildBudgetSave}
        userId={userId}
        expenses={expenses}
        sortCount={cats.length}
      />
    </div>
  )
}
