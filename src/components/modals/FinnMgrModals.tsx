'use client'
/**
 * FinnMgrModals — All 6 dashboard modals defined once, imported everywhere.
 * Font names with spaces always use template literals, never single-quoted strings.
 */
import { useEffect, useRef, useState, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

/* ── Shared types ─────────────────────────────────────────────────────────── */
export type ModalClient = {
  id: string; name: string; email?: string; payment_terms?: string
  address?: string; company?: string
}

type BaseProps = {
  onClose: () => void
  userId: string
  onSuccess?: () => void
}

/* ── Design tokens ────────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 14px',
  background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)',
  borderRadius: 9, fontSize: 13, color: 'var(--in-txt)',
  outline: 'none', fontFamily: 'inherit', marginTop: 5,
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
  letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block',
}

/* ── InfoTooltip — accessible hover + focus tooltip ──────────────────────── */
function InfoTooltip({ tip, id }: { tip: string; id: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 5 }}>
      <button
        type="button"
        aria-describedby={`tip-${id}`}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        style={{ background: 'none', border: 'none', cursor: 'help', padding: 0, color: 'var(--mu2)', fontSize: 12, lineHeight: 1, borderRadius: 99, width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        ℹ️
      </button>
      {show && (
        <span
          id={`tip-${id}`}
          role="tooltip"
          style={{
            position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10,
            padding: '8px 12px', fontSize: 11, color: 'var(--ink)', lineHeight: 1.6,
            width: 220, zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            pointerEvents: 'none', whiteSpace: 'normal',
          }}
        >
          {tip}
        </span>
      )}
    </span>
  )
}

/* ── Field wrapper ────────────────────────────────────────────────────────── */
function Field({ label, htmlFor, tip, tipId, children }: {
  label: string; htmlFor?: string; tip?: string; tipId?: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={htmlFor} style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
        {label}
        {tip && tipId && <InfoTooltip tip={tip} id={tipId} />}
      </label>
      {children}
    </div>
  )
}

/* ── Context panel ────────────────────────────────────────────────────────── */
function ContextPanel({ title, icon, bullets }: { title: string; icon: string; bullets: string[] }) {
  return (
    <div className="modal-context-panel" style={{
      width: 200, flexShrink: 0, background: 'var(--bg3)',
      borderLeft: '1px solid var(--bd)', padding: '24px 18px',
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)', marginBottom: 12 }}>{title}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: '#6366f1', fontWeight: 900, fontSize: 12, flexShrink: 0, marginTop: 1 }}>•</span>
            <span style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.6 }}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Modal shell with context panel ──────────────────────────────────────── */
function ModalShell({
  id, title, subtitle, onClose, children, context, maxWidth = 580,
}: {
  id: string; title: string; subtitle: string; onClose: () => void
  children: React.ReactNode; context: React.ReactNode; maxWidth?: number
}) {
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null)
  const titleId = `modal-title-${id}`

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    // Focus first focusable input after short delay (allows render)
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-modal="${id}"] input, [data-modal="${id}"] select, [data-modal="${id}"] textarea`) as HTMLElement
      el?.focus()
    }, 50)
    return () => { document.removeEventListener('keydown', esc); clearTimeout(t) }
  }, [id, onClose])

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
        zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <motion.div
        className="modal-inner"
        data-modal={id}
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg2)', border: '1px solid var(--bd2)',
          borderRadius: 20, width: '100%', maxWidth,
          boxShadow: '0 30px 90px rgba(0,0,0,0.5)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 id={titleId} style={{ fontWeight: 900, fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.035em', marginBottom: 2 }}>{title}</h3>
            <p style={{ fontSize: 12, color: 'var(--mu)' }}>{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1, padding: 4, borderRadius: 8, marginLeft: 12, flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {/* Body = form + context panel */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {children}
          </div>
          {context}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MODAL 1 — ADD INCOME
══════════════════════════════════════════════════════════════ */
export function IncomeModal({ onClose, userId, onSuccess, clients = [] }: BaseProps & { clients?: ModalClient[] }) {
  const uid = useId()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ date: today, amount: '', client_name: '', category: 'Design', payment_method: 'Bank Transfer', invoice_ref: '', notes: '' })
  const [saving, setSaving] = useState(false)

  function onClientChange(name: string) {
    const c = clients.find(cl => cl.name === name)
    let method = form.payment_method
    if (c?.payment_terms) {
      if (c.payment_terms.includes('Receipt')) method = 'Bank Transfer'
      else if (c.payment_terms === 'Stripe') method = 'Stripe'
    }
    setForm(f => ({ ...f, client_name: name, payment_method: method }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('income').insert({
      user_id: userId, date: form.date, amount: parseFloat(form.amount),
      client_name: form.client_name, category: form.category,
      payment_method: form.payment_method, notes: form.notes, status: 'received',
    })
    setSaving(false)
    if (error) { toast.error('Failed to save income'); return }
    toast.success('Income recorded ✓ 💰'); onSuccess?.(); onClose()
  }

  return (
    <ModalShell id={`income-${uid}`} title="Add Income" subtitle="Record money received to track your revenue." onClose={onClose}
      context={<ContextPanel title="Why track income?" icon="💰" bullets={['Accurate revenue reports for tax time', 'Understand which services earn most', 'Cash flow forecasting and planning', 'See your best-performing clients', 'Spot seasonal revenue patterns']} />}
    >
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Date" htmlFor="inc-date">
            <input id="inc-date" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Amount" htmlFor="inc-amount">
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 13 }}>$</span>
              <input id="inc-amount" type="number" min="0" step="0.01" required placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, paddingLeft: 26 }} />
            </div>
          </Field>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Client / Source" htmlFor="inc-client">
              {clients.length > 0 ? (
                <select id="inc-client" value={form.client_name} onChange={e => onClientChange(e.target.value)} style={inputStyle}>
                  <option value="">Select client or type below</option>
                  {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  <option value="__other">Other / New client</option>
                </select>
              ) : (
                <input id="inc-client" placeholder="Acme Corp, Retainer, etc." value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} style={inputStyle} />
              )}
            </Field>
          </div>
          <Field label="Category" htmlFor="inc-cat" tip="Helps organize different income sources for tax reporting." tipId={`inc-cat-${uid}`}>
            <select id="inc-cat" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
              {['Design','Development','Consulting','Photography','Retainer','Speaking','Writing','Other'].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Payment Method" htmlFor="inc-method" tip="How you received this payment." tipId={`inc-method-${uid}`}>
            <select id="inc-method" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={inputStyle}>
              {['Bank Transfer','Check','Cash','PayPal','Stripe','Venmo','Zelle','Other'].map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Invoice # (optional)" htmlFor="inc-inv">
              <input id="inc-inv" placeholder="INV-042" value={form.invoice_ref} onChange={e => setForm(f => ({ ...f, invoice_ref: e.target.value }))} style={inputStyle} />
            </Field>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Notes" htmlFor="inc-notes">
              <textarea id="inc-notes" rows={2} placeholder="Optional details..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
            </Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>{saving ? 'Saving...' : 'Add Income 💰'}</button>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '12px 20px' }}>Cancel</button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ══════════════════════════════════════════════════════════════
   MODAL 2 — ADD EXPENSE
══════════════════════════════════════════════════════════════ */
export function ExpenseModal({ onClose, userId, onSuccess }: BaseProps) {
  const uid = useId()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ date: today, amount: '', vendor: '', category: 'Software', payment_method: 'Business Card', recurring: false, notes: '' })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const receiptRef = useRef<HTMLInputElement>(null)
  const QUICK_CATS = ['Software','Marketing','Office','Travel','Meals','Payroll','Other']

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    let receipt_url = ''
    if (receiptFile) {
      const path = `${userId}/${Date.now()}_${receiptFile.name}`
      const { error: upErr } = await sb.storage.from('receipts').upload(path, receiptFile)
      if (!upErr) {
        const { data } = sb.storage.from('receipts').getPublicUrl(path)
        receipt_url = data?.publicUrl ?? ''
      }
    }
    const { error } = await sb.from('expenses').insert({
      user_id: userId, date: form.date, amount: parseFloat(form.amount),
      vendor: form.vendor, category: form.category,
      payment_method: form.payment_method, is_recurring: form.recurring,
      is_deductible: true, notes: form.notes, status: 'paid',
      receipt_url,
    })
    setSaving(false)
    if (error) { toast.error('Failed to save expense'); return }
    toast.success('Expense recorded ✓'); onSuccess?.(); onClose()
  }

  return (
    <ModalShell id={`expense-${uid}`} title="Add Expense" subtitle="Track spending to improve profitability and prepare for taxes." onClose={onClose}
      context={<ContextPanel title="Why track expenses?" icon="🧮" bullets={['Reduce your tax burden legally', 'Identify cost-saving opportunities', 'Understand true profit margins', 'Be ready for audits', 'Spot recurring charges to cancel']} />}
    >
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Date" htmlFor="exp-date">
            <input id="exp-date" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Amount" htmlFor="exp-amount">
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 13 }}>$</span>
              <input id="exp-amount" type="number" min="0" step="0.01" required placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, paddingLeft: 26 }} />
            </div>
          </Field>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Vendor / Payee" htmlFor="exp-vendor">
              <input id="exp-vendor" required placeholder="Adobe, AWS, Starbucks..." value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} style={inputStyle} />
            </Field>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Category" htmlFor="exp-cat" tip="Every business expense may be tax deductible. Categorize carefully." tipId={`exp-cat-${uid}`}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6, marginTop: 6 }}>
                {QUICK_CATS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, category: c }))}
                    style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s', background: form.category === c ? '#6366f1' : 'var(--bg3)', color: form.category === c ? '#fff' : 'var(--mu)' }}>
                    {c}
                  </button>
                ))}
              </div>
              <select id="exp-cat" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                {['Software','Marketing','Office','Travel','Meals','Payroll','Equipment','Subscriptions','Professional Services','Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Payment Method" htmlFor="exp-method">
            <select id="exp-method" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={inputStyle}>
              {['Business Card','Personal Card','Bank Transfer','Cash','Check','Other'].map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
            <input type="checkbox" id="exp-recur" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="exp-recur" style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              Recurring <InfoTooltip tip="Check this if this expense repeats monthly or annually (subscriptions, rent, etc.)" id={`exp-recur-${uid}`} />
            </label>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Receipt (optional)">
              <input ref={receiptRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => receiptRef.current?.click()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') receiptRef.current?.click() }}
                style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', justifyContent: 'flex-start' }}>
                <span>📎</span>
                <span style={{ color: receiptFile ? 'var(--ink)' : 'var(--in-ph)', fontSize: 13 }}>
                  {receiptFile ? receiptFile.name : 'Attach receipt (PDF or image)'}
                </span>
              </button>
            </Field>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Notes" htmlFor="exp-notes">
              <textarea id="exp-notes" rows={2} placeholder="Optional details..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
            </Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12, background: 'linear-gradient(135deg, #ff7043, #f59e0b)' }}>{saving ? 'Saving...' : 'Add Expense 🧮'}</button>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '12px 20px' }}>Cancel</button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ══════════════════════════════════════════════════════════════
   MODAL 3 — CREATE INVOICE (with client autofill)
══════════════════════════════════════════════════════════════ */
type LineItem = { description: string; qty: number; rate: number }

export function InvoiceModal({ onClose, userId, onSuccess, clients = [] }: BaseProps & { clients?: ModalClient[] }) {
  const uid = useId()
  const today = new Date().toISOString().split('T')[0]
  const nextInvNum = `INV-${Date.now().toString().slice(-6)}`
  const [form, setForm] = useState({ client_name: '', client_email: '', invoice_number: nextInvNum, issue_date: today, due_date: '', status: 'draft', tax_rate: '0', notes: '' })
  const [items, setItems] = useState<LineItem[]>([{ description: '', qty: 1, rate: 0 }])
  const [autofillChip, setAutofillChip] = useState('')
  const [saving, setSaving] = useState(false)

  function termsToDate(terms: string): string {
    const days = terms.includes('7') ? 7 : terms.includes('15') ? 15 : terms.includes('60') ? 60 : terms.includes('Receipt') ? 0 : 30
    const d = new Date(); d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  function onClientChange(name: string) {
    const c = clients.find(cl => cl.name === name)
    const due = c?.payment_terms ? termsToDate(c.payment_terms) : ''
    setForm(f => ({ ...f, client_name: name, client_email: c?.email ?? f.client_email, due_date: due || f.due_date }))
    if (c) setAutofillChip(c.name)
    else setAutofillChip('')
  }

  function updateItem(i: number, field: keyof LineItem, val: string | number) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }
  function addItem() { setItems(prev => [...prev, { description: '', qty: 1, rate: 0 }]) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  const subtotal = items.reduce((s, it) => s + it.qty * Number(it.rate), 0)
  const taxAmt = subtotal * (parseFloat(form.tax_rate) / 100)
  const total = subtotal + taxAmt

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('invoices').insert({
      user_id: userId,
      invoice_number: form.invoice_number,
      client_name: form.client_name,
      client_email: form.client_email,
      issue_date: form.issue_date,
      due_date: form.due_date,
      status: form.status,
      line_items: items,
      subtotal, tax_rate: parseFloat(form.tax_rate), tax_amount: taxAmt,
      total, balance_due: total, amount_paid: 0,
      notes: form.notes,
    })
    setSaving(false)
    if (error) { toast.error('Failed to create invoice'); return }
    toast.success('Invoice created! 🧾'); onSuccess?.(); onClose()
  }

  return (
    <ModalShell id={`invoice-${uid}`} title="Create Invoice" subtitle="Send professional invoices and get paid faster." onClose={onClose} maxWidth={720}
      context={<ContextPanel title="Invoice tips" icon="🧾" bullets={['Net 30 = client pays within 30 days', 'Include your business name and address', 'Add late fee terms to encourage timely payment', 'PDF download available after saving', 'Send reminders at 7, 14, and 30 days overdue']} />}
    >
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Client" htmlFor="inv-client">
              {clients.length > 0 ? (
                <select id="inv-client" required value={form.client_name} onChange={e => onClientChange(e.target.value)} style={inputStyle}>
                  <option value="">Select a client...</option>
                  {clients.map(c => <option key={c.id} value={c.name}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                </select>
              ) : (
                <input id="inv-client" required placeholder="Client name" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} style={inputStyle} />
              )}
            </Field>
            {autofillChip && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 10, fontWeight: 700, marginTop: 4 }}>
                ✓ Auto-filled from {autofillChip}&apos;s profile
              </div>
            )}
          </div>
          <Field label="Client Email" htmlFor="inv-email">
            <input id="inv-email" type="email" placeholder="client@example.com" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} style={{ ...inputStyle, opacity: autofillChip && form.client_email ? 0.7 : 1 }} />
          </Field>
          <Field label="Invoice #" htmlFor="inv-num">
            <input id="inv-num" required value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Issue Date" htmlFor="inv-issue">
            <input id="inv-issue" type="date" required value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Due Date" htmlFor="inv-due">
            <input id="inv-due" type="date" required value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Status" htmlFor="inv-status">
            <select id="inv-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
              {['draft','sent','paid','overdue','cancelled'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </Field>

          {/* Line items */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Line Items</label>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 80px 28px', gap: 6, marginBottom: 4 }}>
                {['Description','Qty','Rate ($)','Amount',''].map(h => (
                  <span key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)' }}>{h}</span>
                ))}
              </div>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 80px 28px', gap: 6, alignItems: 'center' }}>
                  <input placeholder="Description" value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} style={{ ...inputStyle, marginTop: 0 }} />
                  <input type="number" min="1" value={it.qty} onChange={e => updateItem(i, 'qty', parseInt(e.target.value) || 1)} style={{ ...inputStyle, marginTop: 0, textAlign: 'center' }} />
                  <input type="number" min="0" step="0.01" value={it.rate} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, marginTop: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textAlign: 'right', fontFamily: `DM Mono, monospace` }}>${(it.qty * Number(it.rate)).toFixed(2)}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: 2 }}>×</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addItem} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textAlign: 'left', padding: '4px 0' }}>
                + Add line item
              </button>
            </div>
            {/* Totals */}
            <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg3)', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--mu)' }}>Subtotal</span>
                <span style={{ fontFamily: `DM Mono, monospace`, fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--mu)' }}>Tax</span>
                  <InfoTooltip tip="Your local sales tax rate. Check your state requirements — not all services are taxable." id={`inv-tax-${uid}`} />
                  <input type="number" min="0" max="100" step="0.1" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} style={{ width: 52, padding: '2px 6px', background: 'var(--in-bg)', border: '1px solid var(--in-bd)', borderRadius: 6, fontSize: 12, color: 'var(--in-txt)', outline: 'none', textAlign: 'center' }} />
                  <span style={{ color: 'var(--mu)', fontSize: 11 }}>%</span>
                </div>
                <span style={{ fontFamily: `DM Mono, monospace`, fontWeight: 600 }}>${taxAmt.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, borderTop: '1px solid var(--bd)', paddingTop: 8, marginTop: 4 }}>
                <span style={{ color: 'var(--ink)' }}>Total</span>
                <span style={{ color: '#6366f1', fontFamily: `DM Mono, monospace` }}>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Notes / Terms" htmlFor="inv-notes">
              <textarea id="inv-notes" rows={2} placeholder="Payment terms, late fees, thank you note..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
            </Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>{saving ? 'Creating...' : 'Create Invoice 🧾'}</button>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '12px 20px' }}>Cancel</button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ══════════════════════════════════════════════════════════════
   MODAL 4 — ADD CLIENT
══════════════════════════════════════════════════════════════ */
export function ClientModal({ onClose, userId, onSuccess }: BaseProps) {
  const uid = useId()
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', address: '', website: '', industry: '', status: 'client', payment_terms: 'Net 30', tags: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const COLORS = ['#6366f1','#10b981','#0ea5e9','#f59e0b','#ef4444','#8b5cf6']

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const tagsArr = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const { error } = await sb.from('clients').insert({
      user_id: userId, name: form.name, company: form.company, email: form.email,
      phone: form.phone, address: form.address, website: form.website,
      industry: form.industry, status: form.status, payment_terms: form.payment_terms,
      tags: tagsArr, notes: form.notes,
      avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)],
      total_billed: 0, total_paid: 0, invoice_count: 0,
    })
    setSaving(false)
    if (error) { toast.error('Failed to add client'); return }
    toast.success('Client added ✓ 👥'); onSuccess?.(); onClose()
  }

  return (
    <ModalShell id={`client-${uid}`} title="Add Client" subtitle="Create a customer profile to track revenue, invoices and payments." onClose={onClose}
      context={<ContextPanel title="Why add clients?" icon="👥" bullets={['Create invoices in seconds with saved info', 'Track total revenue per relationship', 'Monitor payment history and habits', 'Identify your most valuable clients', 'Build long-term business relationships']} />}
    >
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Full Name *" htmlFor="cli-name">
            <input id="cli-name" required placeholder="Jane Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Company" htmlFor="cli-co">
            <input id="cli-co" placeholder="Acme Corp" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Email *" htmlFor="cli-email">
            <input id="cli-email" type="email" required placeholder="jane@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Phone" htmlFor="cli-phone" tip="Used for reminders and client communication." tipId={`cli-ph-${uid}`}>
            <input id="cli-phone" placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Address" htmlFor="cli-addr">
            <input id="cli-addr" placeholder="123 Main St, City, ST" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Website" htmlFor="cli-web">
            <input id="cli-web" placeholder="https://example.com" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Industry" htmlFor="cli-ind">
            <select id="cli-ind" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} style={inputStyle}>
              <option value="">Select industry</option>
              {['Design','Development','Marketing','Retail','Healthcare','Finance','Real Estate','Education','Other'].map(i => <option key={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Client Status" htmlFor="cli-status" tip="Lead = prospect. Active Client = paying. VIP = high-value. Recurring = subscription-based." tipId={`cli-st-${uid}`}>
            <select id="cli-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
              {[{v:'lead',l:'Lead'},{v:'client',l:'Active Client'},{v:'vip',l:'VIP'},{v:'recurring',l:'Recurring'},{v:'inactive',l:'Inactive'},{v:'at-risk',l:'At Risk'}].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </Field>
          <Field label="Payment Terms" htmlFor="cli-terms" tip="Determines how long a client has to pay invoices. Net 30 is standard." tipId={`cli-pt-${uid}`}>
            <select id="cli-terms" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} style={inputStyle}>
              {['Due Upon Receipt','Net 7','Net 15','Net 30','Net 60','Custom'].map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Tags (comma separated)" htmlFor="cli-tags">
            <input id="cli-tags" placeholder="design, retainer, q2" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} style={inputStyle} />
          </Field>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Notes" htmlFor="cli-notes">
              <textarea id="cli-notes" rows={2} placeholder="e.g. Prefers email. Pays on time. Decision maker is Sarah." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
            </Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>{saving ? 'Adding...' : 'Add Client 👥'}</button>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '12px 20px' }}>Cancel</button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ══════════════════════════════════════════════════════════════
   MODAL 5 — UPLOAD DOCUMENT (fully working)
══════════════════════════════════════════════════════════════ */
const ALLOWED_TYPES = ['application/pdf','image/png','image/jpeg','image/jpg','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const MAX_SIZE = 25 * 1024 * 1024

export function DocumentModal({ onClose, userId, onSuccess }: BaseProps) {
  const uid = useId()
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({ name: '', category: 'Other', notes: '' })
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  function handleFile(f: File) {
    if (!ALLOWED_TYPES.includes(f.type) && !f.name.match(/\.(pdf|png|jpg|jpeg|csv|xlsx|xls|docx|doc)$/i)) {
      toast.error('Unsupported file type. Use PDF, image, CSV, XLSX, or DOCX.')
      return
    }
    if (f.size > MAX_SIZE) { toast.error('File too large. Maximum size is 25MB.'); return }
    setFile(f)
    if (!form.name) setForm(frm => ({ ...frm, name: f.name.replace(/\.[^.]+$/, '') }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { toast.error('Please select a file first'); return }
    setUploading(true); setProgress(10)
    const sb = createClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${userId}/${Date.now()}_${safeName}`
    setProgress(30)
    const { error: upErr } = await sb.storage.from('documents').upload(path, file, { cacheControl: '3600', upsert: false })
    setProgress(70)
    if (upErr) { toast.error(`Upload failed: ${upErr.message}`); setUploading(false); setProgress(0); return }
    const { error: dbErr } = await sb.from('documents').insert({
      user_id: userId,
      name: form.name || file.name,
      original_name: file.name,
      category: form.category,
      file_path: path,
      file_url: '',
      size_bytes: file.size,
      mime_type: file.type,
      notes: form.notes,
    })
    setProgress(100)
    setUploading(false)
    if (dbErr) { toast.error(`Database error: ${dbErr.message}`); return }
    toast.success('Document uploaded successfully ✓ 📁'); onSuccess?.(); onClose()
  }

  return (
    <ModalShell id={`doc-${uid}`} title="Upload Document" subtitle="Store business documents securely and access them anywhere." onClose={onClose}
      context={<ContextPanel title="Document vault benefits" icon="📁" bullets={['IRS requires 7 years of business records', 'Share securely with your accountant', 'Never lose a receipt again', 'Access from any device, anytime', 'Organize by category for tax time']} />}
    >
      <form onSubmit={submit}>
        {/* Drop zone */}
        <div
          ref={dropRef}
          role="button"
          tabIndex={0}
          aria-label="Click or press Enter to select a file to upload"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          style={{
            border: `2px dashed ${dragOver ? '#6366f1' : 'var(--bd2)'}`,
            borderRadius: 14, padding: '28px 20px', textAlign: 'center',
            cursor: 'pointer', marginBottom: 16, transition: 'all 0.2s',
            background: dragOver ? 'rgba(99,102,241,0.05)' : 'var(--bg3)',
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.docx,.doc"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
          <div style={{ fontSize: 32, marginBottom: 8 }}>{file ? '✅' : '📁'}</div>
          {file ? (
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 2 }}>{file.name}</p>
              <p style={{ fontSize: 11, color: 'var(--mu)' }}>{(file.size / 1024).toFixed(0)} KB · Click to change</p>
            </div>
          ) : (
            <div>
              <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>Drop a file here or click to browse</p>
              <p style={{ fontSize: 11, color: 'var(--mu2)' }}>PDF · PNG · JPG · XLSX · DOCX · CSV (Max 25MB)</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="progress-track" style={{ marginBottom: 16 }}>
            <div className="progress-fill" style={{ width: `${progress}%`, background: '#6366f1', transition: 'width 0.4s ease' }} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Document Name" htmlFor="doc-name">
            <input id="doc-name" placeholder="Auto-filled from filename" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Category" htmlFor="doc-cat">
            <select id="doc-cat" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
              {['Invoices','Tax Documents','Bank Statements','Contracts','Reports','Receipts','Other'].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Notes" htmlFor="doc-notes">
              <textarea id="doc-notes" rows={2} placeholder="Optional notes about this document..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
            </Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" disabled={uploading || !file} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>{uploading ? `Uploading ${progress}%...` : 'Upload Document 📁'}</button>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '12px 20px' }}>Cancel</button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ══════════════════════════════════════════════════════════════
   MODAL 6 — CREATE BUDGET
══════════════════════════════════════════════════════════════ */
const BUDGET_ICONS: Record<string, string> = { Software: '💻', Marketing: '📣', Office: '🏢', Travel: '✈️', Meals: '🍽️', Payroll: '💼', Other: '📦' }

export function BudgetModal({ onClose, userId, onSuccess }: BaseProps) {
  const uid = useId()
  const firstOfMonth = new Date(); firstOfMonth.setDate(1)
  const startDate = firstOfMonth.toISOString().split('T')[0]
  const [form, setForm] = useState({ name: 'Software', monthly_limit: '', alert_at: '80', start_date: startDate, notes: '' })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('budget_categories').insert({
      user_id: userId, name: form.name, icon: BUDGET_ICONS[form.name] ?? '📦',
      monthly_limit: parseFloat(form.monthly_limit), alert_at_percent: parseInt(form.alert_at),
      sort_order: 0,
    })
    setSaving(false)
    if (error) { toast.error('Failed to create budget'); return }
    toast.success('Budget category created ✓ 🎯'); onSuccess?.(); onClose()
  }

  return (
    <ModalShell id={`budget-${uid}`} title="Create Budget" subtitle="Set spending limits and get alerts before you overspend." onClose={onClose}
      context={<ContextPanel title="Budgeting tips" icon="🎯" bullets={['Start with your 3 biggest expense categories', 'Set alerts at 80% to avoid surprises', 'Review budgets monthly', 'Most businesses overspend on software', 'Use budgets to negotiate better vendor rates']} />}
    >
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Category" htmlFor="bud-cat">
              <select id="bud-cat" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle}>
                {Object.keys(BUDGET_ICONS).map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            {/* Icon preview */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {Object.entries(BUDGET_ICONS).map(([cat, icon]) => (
                <button key={cat} type="button" onClick={() => setForm(f => ({ ...f, name: cat }))}
                  style={{ width: 40, height: 40, borderRadius: 10, border: form.name === cat ? '2px solid #6366f1' : '1px solid var(--bd2)', background: form.name === cat ? 'rgba(99,102,241,0.1)' : 'var(--bg3)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <Field label="Monthly Limit ($)" htmlFor="bud-limit">
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 13 }}>$</span>
              <input id="bud-limit" type="number" min="0" step="0.01" required placeholder="500.00" value={form.monthly_limit} onChange={e => setForm(f => ({ ...f, monthly_limit: e.target.value }))} style={{ ...inputStyle, paddingLeft: 26 }} />
            </div>
          </Field>
          <Field label="Alert Threshold" htmlFor="bud-alert" tip="Get notified when spending reaches this percentage of your monthly limit." tipId={`bud-al-${uid}`}>
            <div style={{ position: 'relative' }}>
              <input id="bud-alert" type="number" min="1" max="100" value={form.alert_at} onChange={e => setForm(f => ({ ...f, alert_at: e.target.value }))} style={inputStyle} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mu)', fontSize: 13 }}>%</span>
            </div>
          </Field>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Notes" htmlFor="bud-notes">
              <textarea id="bud-notes" rows={2} placeholder="e.g. Includes all SaaS subscriptions and tools" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
            </Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>{saving ? 'Saving...' : 'Create Budget 🎯'}</button>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '12px 20px' }}>Cancel</button>
        </div>
      </form>
    </ModalShell>
  )
}
