'use client'
/*
 * INVOICES PAGE — Run supabase/migrations/invoices_enhanced.sql first.
 * Font names with spaces use template literals, never single-quoted strings.
 */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatDistanceToNow, format, addDays, differenceInDays } from 'date-fns'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import CountUp from 'react-countup'

/* ── Types ───────────────────────────────────────────────────────────────── */
type LineItem = { description: string; qty: number; rate: number; discount?: number; tax?: number }
type PaymentRecord = { amount: number; date: string; method: string; reference?: string }

type Invoice = {
  id: string; user_id: string; invoice_number: string
  client_name: string; client_email?: string; client_address?: string
  issue_date?: string; due_date: string; status: string
  line_items?: LineItem[]; items?: LineItem[]
  subtotal?: number; tax_rate?: number; tax_amount?: number
  total?: number; amount_paid?: number; balance_due?: number
  notes?: string; internal_notes?: string
  payment_method?: string; reference_number?: string
  viewed_at?: string; email_sent_at?: string; reminder_sent_at?: string
  paid_at?: string; created_at: string; updated_at?: string
  payment_probability?: string
}

type Client = { id: string; name: string; email?: string; company?: string; address?: string; payment_terms?: string }

type DrawerMode = 'new' | 'edit' | null

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:     { label: 'Draft',        color: 'var(--mu)',  bg: 'var(--bg3)',                   border: 'var(--bd2)' },
  sent:      { label: 'Sent',         color: '#0ea5e9',  bg: 'rgba(14,165,233,0.1)',          border: 'rgba(14,165,233,0.25)' },
  viewed:    { label: 'Viewed',       color: '#8b5cf6',  bg: 'rgba(139,92,246,0.1)',          border: 'rgba(139,92,246,0.25)' },
  partial:   { label: 'Partial',      color: '#f59e0b',  bg: 'rgba(245,158,11,0.1)',          border: 'rgba(245,158,11,0.25)' },
  paid:      { label: 'Paid',         color: '#10b981',  bg: 'rgba(16,185,129,0.1)',          border: 'rgba(16,185,129,0.25)' },
  overdue:   { label: 'Overdue',      color: '#ef4444',  bg: 'rgba(239,68,68,0.1)',           border: 'rgba(239,68,68,0.25)' },
  cancelled: { label: 'Cancelled',    color: 'var(--mu2)', bg: 'var(--bg3)',                   border: 'var(--bd)' },
  refunded:  { label: 'Refunded',     color: '#ff7043',  bg: 'rgba(255,112,67,0.1)',          border: 'rgba(255,112,67,0.25)' },
}
const ALL_STATUSES = ['draft','sent','viewed','partial','paid','overdue','cancelled']
const BOARD_COLS = ['draft','sent','viewed','partial','paid','overdue']

const PAYMENT_TERMS_OPTIONS = ['Due Upon Receipt','Net 7','Net 15','Net 30','Net 60','Custom']
const PAYMENT_METHODS = ['Bank Transfer','Check','Cash','Stripe','PayPal','Square','Venmo','Zelle','Other']
const DEPOSIT_ACCOUNTS = ['Business Checking','Business Savings','Cash','Stripe Balance','PayPal Balance','Other']

const LEARN = {
  'Total Invoiced':   { def: 'Total value of all invoices ever created.', tip: 'Includes paid, unpaid, and draft invoices.' },
  'Paid':             { def: 'Total amount fully collected from clients.', tip: 'Only counts fully paid invoices.' },
  'Unpaid':           { def: 'Total outstanding across all unpaid invoices.', tip: 'Includes sent, viewed, partial, and overdue.' },
  'Overdue':          { def: 'Invoices past their due date and not paid.', tip: 'Follow up immediately — every day costs you.' },
  'Collection Rate':  { def: 'Percentage of invoiced amounts collected. Industry average is 85%.', tip: 'Calculated as Total Paid ÷ Total Invoiced × 100.' },
  'Avg Payment Time': { def: 'Average days clients take to pay. Under 30 days is healthy.', tip: 'Shorten it by invoicing immediately after delivery.' },
  'Avg Invoice Value':{ def: 'Your average invoice size. Higher is better for efficiency.', tip: 'Package services together to raise this number.' },
  'Revenue This Month':{ def: 'Total payments received in the current calendar month.', tip: 'Compare month-over-month to track growth.' },
  'Partially Paid':   { def: 'Invoices where the client paid some but not all.', tip: 'Follow up for the remaining balance promptly.' },
}

/* ── Helper: get line items (handles items vs line_items column) ─────────── */
function getLineItems(inv: Invoice): LineItem[] {
  return (inv.line_items && inv.line_items.length > 0)
    ? inv.line_items
    : (inv.items ?? [])
}

function calcTotal(items: LineItem[]): number {
  return items.reduce((s, it) => s + (it.qty * it.rate), 0)
}

function getTotal(inv: Invoice): number {
  if (inv.total && inv.total > 0) return inv.total
  return calcTotal(getLineItems(inv))
}

function getBalance(inv: Invoice): number {
  if (inv.balance_due !== undefined && inv.balance_due !== null) return inv.balance_due
  return getTotal(inv) - (inv.amount_paid ?? 0)
}

function daysPast(dueDateStr: string): number {
  return differenceInDays(new Date(), new Date(dueDateStr))
}

function paymentTermsToDays(terms: string): number {
  if (terms.includes('Receipt')) return 0
  if (terms.includes('7')) return 7
  if (terms.includes('15')) return 15
  if (terms.includes('30')) return 30
  if (terms.includes('60')) return 60
  return 30
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const iStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)',
  borderRadius: 9, fontSize: '0.8rem', color: 'var(--in-txt)',
  outline: 'none', fontFamily: 'inherit',
}

const lStyle: React.CSSProperties = {
  fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
  letterSpacing: '0.09em', color: 'var(--mu2)', display: 'block', marginBottom: 4,
}

/* ── StatusBadge ─────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 99,
      fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  )
}

/* ── InfoIcon ────────────────────────────────────────────────────────────── */
function InfoIcon({ label, onLearn }: { label: string; onLearn: (l: string) => void }) {
  const [show, setShow] = useState(false)
  const tip = LEARN[label as keyof typeof LEARN]
  if (!tip) return null
  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 4 }}>
      <button type="button"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)}
        onClick={e => { e.stopPropagation(); onLearn(label) }}
        aria-label={`Learn about ${label}`}
        style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--bd2)', color: 'var(--mu)', fontSize: 9, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        ⓘ
      </button>
      {show && (
        <span role="tooltip" style={{
          position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10,
          padding: '8px 12px', fontSize: '0.7rem', color: 'var(--ink)', lineHeight: 1.6,
          width: 200, zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          pointerEvents: 'none', whiteSpace: 'normal',
        }}>
          {tip.tip}
          <span style={{ display: 'block', color: '#6366f1', fontWeight: 700, marginTop: 3, fontSize: '0.65rem' }}>Click to learn more →</span>
        </span>
      )}
    </span>
  )
}

/* ── Learn Panel ─────────────────────────────────────────────────────────── */
function LearnPanel({ label, onClose }: { label: string; onClose: () => void }) {
  const tip = LEARN[label as keyof typeof LEARN]
  if (!tip) return null
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 280 }}
      role="dialog" aria-modal="true" aria-label={label}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 850, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
        <h3 style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--ink)', letterSpacing: '-0.03em' }}>{label}</h3>
        <button onClick={onClose} aria-label="Close learn panel" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22 }}>×</button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
        <p style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1', marginBottom: 8 }}>Definition</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--ink)', lineHeight: 1.7, marginBottom: 20 }}>{tip.def}</p>
        <p style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1', marginBottom: 8 }}>Tip</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--ink)', lineHeight: 1.7 }}>{tip.tip}</p>
      </div>
    </motion.div>
  )
}

/* ── Chart tooltip ───────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: '0.75rem' }}>
      <p style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: '#10b981' }}>${Number(p.value).toLocaleString()}</p>)}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   INVOICE DRAWER
═══════════════════════════════════════════════════════════════════════════ */
function InvoiceDrawer({
  open, mode, invoice, clients, userId, onClose, onSaved,
}: {
  open: boolean; mode: DrawerMode; invoice: Invoice | null
  clients: Client[]; userId: string
  onClose: () => void; onSaved: () => void
}) {
  const firstRef = useRef<HTMLSelectElement>(null)
  const today = new Date().toISOString().split('T')[0]

  const blankForm = {
    client_name: '', client_email: '', client_address: '',
    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
    issue_date: today, due_date: '', payment_terms: 'Net 30',
    status: 'draft', notes: '', internal_notes: '',
    tax_rate: '0',
  }

  const [form, setForm] = useState(blankForm)
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', qty: 1, rate: 0 }])
  const [autofillClient, setAutofillClient] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', date: today, method: 'Bank Transfer', account: 'Business Checking', reference: '', notes: '' })

  // Reset on open
  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && invoice) {
      const items = getLineItems(invoice)
      setLineItems(items.length > 0 ? items : [{ description: '', qty: 1, rate: 0 }])
      setForm({
        client_name: invoice.client_name,
        client_email: invoice.client_email ?? '',
        client_address: invoice.client_address ?? '',
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date ?? today,
        due_date: invoice.due_date,
        payment_terms: 'Net 30',
        status: invoice.status,
        notes: invoice.notes ?? '',
        internal_notes: invoice.internal_notes ?? '',
        tax_rate: String(invoice.tax_rate ?? 0),
      })
      setAutofillClient('')
    } else {
      setForm({ ...blankForm, invoice_number: `INV-${Date.now().toString().slice(-6)}` })
      setLineItems([{ description: '', qty: 1, rate: 0 }])
      setAutofillClient('')
    }
    setTimeout(() => firstRef.current?.focus(), 80)
  }, [open, mode, invoice])

  // Escape key
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  function onClientSelect(name: string) {
    const c = clients.find(cl => cl.name === name)
    if (c) {
      const days = paymentTermsToDays(c.payment_terms ?? 'Net 30')
      const due = format(addDays(new Date(), days), 'yyyy-MM-dd')
      setForm(f => ({
        ...f, client_name: c.name, client_email: c.email ?? '',
        client_address: c.address ?? '',
        payment_terms: c.payment_terms ?? 'Net 30',
        due_date: due,
      }))
      setAutofillClient(c.name)
    } else {
      setForm(f => ({ ...f, client_name: name }))
      setAutofillClient('')
    }
  }

  function updateItem(i: number, field: keyof LineItem, val: string | number) {
    setLineItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }
  function addItem() { setLineItems(p => [...p, { description: '', qty: 1, rate: 0 }]) }
  function removeItem(i: number) { setLineItems(p => p.filter((_, idx) => idx !== i)) }

  const subtotal = lineItems.reduce((s, it) => s + it.qty * Number(it.rate), 0)
  const taxAmt = subtotal * (parseFloat(form.tax_rate) / 100)
  const grandTotal = subtotal + taxAmt
  const existingPaid = invoice?.amount_paid ?? 0
  const balanceDue = grandTotal - existingPaid

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const payload = {
      client_name: form.client_name, client_email: form.client_email,
      client_address: form.client_address, invoice_number: form.invoice_number,
      issue_date: form.issue_date, due_date: form.due_date, status: form.status,
      line_items: lineItems, items: lineItems,
      subtotal, tax_rate: parseFloat(form.tax_rate), tax_amount: taxAmt,
      total: grandTotal, balance_due: balanceDue,
      notes: form.notes, internal_notes: form.internal_notes,
    }
    if (mode === 'edit' && invoice) {
      const { error } = await sb.from('invoices').update(payload).eq('id', invoice.id)
      if (error) { toast.error('Failed to save'); setSaving(false); return }
      toast.success('Invoice updated ✓')
    } else {
      const { error } = await sb.from('invoices').insert({ user_id: userId, ...payload })
      if (error) { toast.error('Failed to create invoice'); setSaving(false); return }
      toast.success('Invoice created! 🧾')
    }
    setSaving(false); onSaved(); onClose()
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    if (!invoice) return
    const paidAmt = existingPaid + parseFloat(payForm.amount)
    const newStatus = paidAmt >= grandTotal ? 'paid' : 'partial'
    const { error } = await sb.from('invoices').update({
      amount_paid: paidAmt, balance_due: grandTotal - paidAmt, status: newStatus,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : undefined,
      payment_method: payForm.method, reference_number: payForm.reference,
    }).eq('id', invoice.id)
    setSaving(false)
    if (error) { toast.error('Failed to record payment'); return }
    toast.success(newStatus === 'paid' ? 'Invoice fully paid! 💰' : 'Partial payment recorded ✓')
    onSaved(); onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 799 }} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            role="dialog" aria-modal="true" aria-label={mode === 'edit' ? 'Edit Invoice' : 'New Invoice'}
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(680px, 100vw)', background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--ink)', letterSpacing: '-0.035em' }}>
                  {mode === 'edit' ? `Edit ${invoice?.invoice_number}` : 'New Invoice'}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--mu)', marginTop: 2 }}>
                  {mode === 'edit' ? 'Update invoice details below.' : 'Fill in the details to create a professional invoice.'}
                </p>
              </div>
              <button onClick={onClose} aria-label="Close modal" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <form onSubmit={save} id="invoice-form">
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
                  <p style={{ ...lStyle, marginBottom: 10, color: '#6366f1' }}>§1 — Client</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={lStyle}>Client Name *</label>
                      {clients.length > 0 ? (
                        <select ref={firstRef} required value={form.client_name}
                          onChange={e => onClientSelect(e.target.value)} style={iStyle}>
                          <option value="">Select a client...</option>
                          {clients.map(c => <option key={c.id} value={c.name}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                          <option value="__new">+ Add new client</option>
                        </select>
                      ) : (
                        <input required placeholder="Client name" value={form.client_name}
                          onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} style={iStyle} />
                      )}
                      {autofillClient && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, padding: '3px 10px', borderRadius: 99, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.65rem', fontWeight: 700 }}>
                          ✓ Auto-filled from {autofillClient}&apos;s profile
                        </span>
                      )}
                    </div>
                    <div>
                      <label style={lStyle}>Client Email</label>
                      <input type="email" placeholder="client@example.com" value={form.client_email}
                        onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} style={iStyle} />
                    </div>
                    <div>
                      <label style={lStyle}>Client Address</label>
                      <input placeholder="123 Main St, City, ST" value={form.client_address}
                        onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))} style={iStyle} />
                    </div>
                  </div>
                </div>

                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
                  <p style={{ ...lStyle, marginBottom: 10, color: '#6366f1' }}>§2 — Invoice Details</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lStyle}>Invoice #</label>
                      <input required value={form.invoice_number}
                        onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} style={iStyle} />
                    </div>
                    <div>
                      <label style={lStyle}>Issue Date</label>
                      <input type="date" required value={form.issue_date}
                        onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} style={iStyle} />
                    </div>
                    <div>
                      <label style={lStyle}>Due Date</label>
                      <input type="date" required value={form.due_date}
                        onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={iStyle} />
                    </div>
                    <div>
                      <label style={lStyle}>Payment Terms</label>
                      <select value={form.payment_terms}
                        onChange={e => {
                          const days = paymentTermsToDays(e.target.value)
                          const due = days === 0 ? form.issue_date : format(addDays(new Date(form.issue_date || today), days), 'yyyy-MM-dd')
                          setForm(f => ({ ...f, payment_terms: e.target.value, due_date: due }))
                        }} style={iStyle}>
                        {PAYMENT_TERMS_OPTIONS.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lStyle}>Status</label>
                      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={iStyle}>
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lStyle}>Tax Rate (%)</label>
                      <input type="number" min="0" max="100" step="0.1" value={form.tax_rate}
                        onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} style={iStyle} />
                    </div>
                    <div>
                      <label style={lStyle}>Notes (shown to client)</label>
                      <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Thank you for your business..."
                        style={{ ...iStyle, height: 64, resize: 'none', lineHeight: 1.6 }} />
                    </div>
                    <div>
                      <label style={lStyle}>Internal Notes (not shown to client)</label>
                      <textarea value={form.internal_notes} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                        placeholder="Private notes..."
                        style={{ ...iStyle, height: 64, resize: 'none', lineHeight: 1.6 }} />
                    </div>
                  </div>
                </div>

                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
                  <p style={{ ...lStyle, marginBottom: 12, color: '#6366f1' }}>§3 — Line Items</p>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 30px 80px', gap: 6, marginBottom: 6 }}>
                    {['Description','Qty','Rate ($)','Tax%','Amount'].map(h => (
                      <span key={h} style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)' }}>{h}</span>
                    ))}
                  </div>
                  {lineItems.map((it, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 30px 80px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                      <input placeholder="Service or product description" value={it.description}
                        onChange={e => updateItem(i, 'description', e.target.value)}
                        style={{ ...iStyle, padding: '6px 10px' }} />
                      <input type="number" min="1" value={it.qty}
                        onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 1)}
                        style={{ ...iStyle, padding: '6px 8px', textAlign: 'center' }} />
                      <input type="number" min="0" step="0.01" value={it.rate}
                        onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)}
                        style={{ ...iStyle, padding: '6px 8px' }} />
                      <input type="number" min="0" max="100" step="0.1" value={it.tax ?? 0}
                        onChange={e => updateItem(i, 'tax', parseFloat(e.target.value) || 0)}
                        style={{ ...iStyle, padding: '6px 6px', fontSize: '0.7rem' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink)', fontFamily: `DM Mono, monospace` }}>
                          ${(it.qty * Number(it.rate)).toFixed(2)}
                        </span>
                        {lineItems.length > 1 && (
                          <button type="button" onClick={() => removeItem(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 2 }}>×</button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addItem}
                    style={{ fontSize: '0.75rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '6px 0' }}>
                    + Add line item
                  </button>

                  {/* Totals */}
                  <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--bg3)', borderRadius: 12 }}>
                    {[
                      { label: 'Subtotal', val: `$${subtotal.toFixed(2)}` },
                      { label: `Tax (${form.tax_rate}%)`, val: `$${taxAmt.toFixed(2)}` },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 6 }}>
                        <span style={{ color: 'var(--mu)' }}>{r.label}</span>
                        <span style={{ fontFamily: `DM Mono, monospace`, fontWeight: 600 }}>{r.val}</span>
                      </div>
                    ))}
                    {existingPaid > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 6 }}>
                        <span style={{ color: '#10b981' }}>Paid</span>
                        <span style={{ fontFamily: `DM Mono, monospace`, fontWeight: 600, color: '#10b981' }}>-${existingPaid.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 900, borderTop: '1px solid var(--bd)', paddingTop: 8, marginTop: 4 }}>
                      <span style={{ color: 'var(--ink)' }}>{existingPaid > 0 ? 'Balance Due' : 'Total'}</span>
                      <span style={{ color: '#6366f1', fontFamily: `DM Mono, monospace` }}>
                        ${(existingPaid > 0 ? balanceDue : grandTotal).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </form>

              {/* Payment Recording (edit mode only) */}
              {mode === 'edit' && invoice && invoice.status !== 'paid' && (
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
                  <button type="button" onClick={() => setShowPayment(p => !p)}
                    style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>
                    {showPayment ? '▲ Hide' : '💰 Record Payment'}
                  </button>
                  <AnimatePresence>
                    {showPayment && (
                      <motion.form onSubmit={recordPayment} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={lStyle}>Amount ($) *</label>
                            <input type="number" required min="0.01" step="0.01" placeholder={`Max $${balanceDue.toFixed(2)}`}
                              value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} style={iStyle} />
                          </div>
                          <div>
                            <label style={lStyle}>Payment Date</label>
                            <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} style={iStyle} />
                          </div>
                          <div>
                            <label style={lStyle}>Payment Method</label>
                            <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} style={iStyle}>
                              {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={lStyle}>Deposit Account</label>
                            <select value={payForm.account} onChange={e => setPayForm(f => ({ ...f, account: e.target.value }))} style={iStyle}>
                              {DEPOSIT_ACCOUNTS.map(a => <option key={a}>{a}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={lStyle}>Reference #</label>
                            <input placeholder="Check #, transaction ID..." value={payForm.reference}
                              onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} style={iStyle} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button type="submit" disabled={saving} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '9px', background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                              {saving ? 'Saving...' : 'Record Payment'}
                            </button>
                          </div>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button type="submit" form="invoice-form" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>
                {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Invoice 🧾'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '12px 20px' }}>Cancel</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const [drawer, setDrawer] = useState<DrawerMode>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [view, setView] = useState<'table' | 'board'>('table')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [learnLabel, setLearnLabel] = useState<string | null>(null)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [{ data: inv }, { data: cli }] = await Promise.all([
      sb.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      sb.from('clients').select('id,name,email,company,address,payment_terms').eq('user_id', user.id),
    ])
    setInvoices(inv ?? [])
    setClients(cli ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* KPI computations */
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const totalInvoiced = invoices.reduce((s, i) => s + getTotal(i), 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + getTotal(i), 0)
  const totalPartial = invoices.filter(i => i.status === 'partial').reduce((s, i) => s + (i.amount_paid ?? 0), 0)
  const totalUnpaid = invoices.filter(i => ['sent','viewed','partial','overdue'].includes(i.status)).reduce((s, i) => s + getBalance(i), 0)
  const overdueCount = invoices.filter(i => i.status === 'overdue').length
  const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + getBalance(i), 0)
  const collectionRate = totalInvoiced > 0 ? Math.round(((totalPaid + totalPartial) / totalInvoiced) * 100) : 0
  const paidInvoices = invoices.filter(i => i.status === 'paid' && i.paid_at)
  const avgPaymentDays = paidInvoices.length > 0
    ? Math.round(paidInvoices.reduce((s, i) => s + differenceInDays(new Date(i.paid_at!), new Date(i.created_at)), 0) / paidInvoices.length)
    : 0
  const avgValue = invoices.length > 0 ? totalInvoiced / invoices.length : 0
  const revenueThisMonth = invoices.filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at) >= monthStart).reduce((s, i) => s + getTotal(i), 0)
  const partialCount = invoices.filter(i => i.status === 'partial').length
  const notEmailed = invoices.filter(i => i.status === 'sent' && !i.email_sent_at).length

  /* Monthly revenue chart data */
  const revenueByMonth = useMemo(() => {
    const months: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months[format(d, 'MMM yy')] = 0
    }
    invoices.filter(i => i.status === 'paid' && i.paid_at).forEach(inv => {
      const key = format(new Date(inv.paid_at!), 'MMM yy')
      if (months[key] !== undefined) months[key] += getTotal(inv)
    })
    return Object.entries(months).map(([label, amount]) => ({ label, amount }))
  }, [invoices])

  /* Search + filter */
  const filtered = useMemo(() => {
    let list = [...invoices]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.invoice_number.toLowerCase().includes(q) ||
        i.client_name.toLowerCase().includes(q) ||
        i.client_email?.toLowerCase().includes(q) ||
        String(getTotal(i)).includes(q)
      )
    }
    if (statusFilter === 'unpaid') list = list.filter(i => ['sent','viewed','partial','overdue'].includes(i.status))
    else if (statusFilter === 'this-month') list = list.filter(i => new Date(i.created_at) >= monthStart)
    else if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter)
    return list
  }, [invoices, search, statusFilter])

  function openNew() { setSelectedInvoice(null); setDrawer('new') }
  function openEdit(inv: Invoice) { setSelectedInvoice(inv); setDrawer('edit') }

  async function deleteInvoice(id: string) {
    const sb = createClient()
    await sb.from('invoices').delete().eq('id', id)
    toast.success('Invoice deleted')
    setInvoices(prev => prev.filter(i => i.id !== id))
  }

  async function quickStatus(id: string, status: string) {
    const sb = createClient()
    const updates: Partial<Invoice> = { status }
    if (status === 'paid') { updates.amount_paid = getTotal(invoices.find(i => i.id === id)!); updates.paid_at = new Date().toISOString() }
    await sb.from('invoices').update(updates).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    toast.success(`Marked as ${STATUS_CONFIG[status]?.label ?? status}`)
  }

  /* Payment probability heuristic */
  function probScore(clientName: string): { label: string; color: string; bg: string } {
    const clientInvs = invoices.filter(i => i.client_name === clientName)
    const paid = clientInvs.filter(i => i.status === 'paid').length
    const late = clientInvs.filter(i => i.status === 'overdue').length
    if (paid > late && paid > 0) return { label: 'High', color: '#10b981', bg: 'rgba(16,185,129,0.1)' }
    if (late > paid) return { label: 'At Risk', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    return { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
  }

  const KPI_CARDS = [
    { label: 'Total Invoiced', value: totalInvoiced, prefix: '$', dec: 2, color: '#6366f1' },
    { label: 'Paid', value: totalPaid, prefix: '$', dec: 2, color: '#10b981' },
    { label: 'Unpaid', value: totalUnpaid, prefix: '$', dec: 2, color: '#f59e0b' },
    { label: 'Partially Paid', value: partialCount, prefix: '', dec: 0, color: '#0ea5e9', suffix: ' invoices' },
    { label: 'Overdue', value: overdueCount, prefix: '', dec: 0, color: '#ef4444', suffix: ` (${overdueAmount > 0 ? `$${overdueAmount.toFixed(0)}` : '$0'})` },
    { label: 'Collection Rate', value: collectionRate, prefix: '', dec: 0, color: collectionRate >= 85 ? '#10b981' : '#f59e0b', suffix: '%' },
    { label: 'Avg Payment Time', value: avgPaymentDays, prefix: '', dec: 0, color: avgPaymentDays <= 30 ? '#10b981' : '#f59e0b', suffix: ' days' },
    { label: 'Avg Invoice Value', value: avgValue, prefix: '$', dec: 2, color: '#8b5cf6' },
    { label: 'Revenue This Month', value: revenueThisMonth, prefix: '$', dec: 2, color: '#14b8a6' },
  ]

  const FILTER_PILLS = [
    { key: 'all', label: 'All' }, { key: 'draft', label: 'Draft' }, { key: 'sent', label: 'Sent' },
    { key: 'paid', label: 'Paid' }, { key: 'unpaid', label: 'Unpaid' }, { key: 'overdue', label: 'Overdue' },
    { key: 'this-month', label: 'This Month' },
  ]

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 40, width: 240, marginBottom: 24 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[...Array(9)].map((_, i) => <div key={i} style={{ height: 88 }} className="skeleton" />)}
        </div>
        <div style={{ height: 300 }} className="skeleton" />
      </div>
    )
  }

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Invoices</h1>
            <p style={{ color: 'var(--mu)', fontSize: '0.8rem', marginTop: 4 }}>Create, send, track, and collect payments from clients.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={openNew}>+ New Invoice</button>
            {(['Email Setup','Payment Settings','Import','Export'] as const).map(label => (
              <button key={label} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '7px 14px' }}
                onClick={() => toast(`${label} coming soon 🚀`)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Today's Invoice Brief ── */}
        {(overdueCount > 0 || totalUnpaid > 0 || notEmailed > 0) && (
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            {overdueCount > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--ink)', fontWeight: 600 }}>
                    <strong style={{ color: '#ef4444' }}>{overdueCount}</strong> invoice{overdueCount > 1 ? 's' : ''} are overdue — ${overdueAmount.toLocaleString()} outstanding
                  </p>
                </div>
                <button onClick={() => { setStatusFilter('overdue'); toast('Filtered to overdue invoices') }}
                  style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Send Reminders
                </button>
              </div>
            )}
            {totalUnpaid > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>💰</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--ink)', fontWeight: 600 }}>
                    <strong style={{ color: '#f59e0b' }}>${totalUnpaid.toLocaleString()}</strong> total unpaid across {invoices.filter(i => ['sent','viewed','partial','overdue'].includes(i.status)).length} invoices
                  </p>
                </div>
                <button onClick={() => setStatusFilter('unpaid')}
                  style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  View Unpaid
                </button>
              </div>
            )}
            {notEmailed > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderLeft: '4px solid #6366f1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>📧</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--ink)', fontWeight: 600 }}>
                    <strong style={{ color: '#6366f1' }}>{notEmailed}</strong> invoice{notEmailed > 1 ? 's' : ''} sent but not yet emailed to clients
                  </p>
                </div>
                <button onClick={() => toast('Email sending coming soon 📧')}
                  style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.1)', border: '1.5px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Send Now
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── 9 KPI Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {KPI_CARDS.map((k, i) => (
            <motion.div key={k.label} className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.35 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="stat-label" style={{ fontSize: '0.7rem' }}>{k.label}</span>
                <InfoIcon label={k.label} onLearn={setLearnLabel} />
              </div>
              <div className="stat-value" style={{ color: k.color, fontSize: 20 }}>
                {k.prefix}<CountUp end={k.value} decimals={k.dec} duration={1.2} separator="," />{k.suffix ?? ''}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Smart Collections Center (overdue only) ── */}
        {overdueCount > 0 && (
          <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontWeight: 900, fontSize: '0.95rem', color: '#ef4444', letterSpacing: '-0.03em' }}>⚠️ Smart Collections Center</h2>
              <span style={{ fontSize: '0.7rem', color: 'var(--mu)' }}>{overdueCount} overdue invoices requiring action</span>
            </div>
            <div>
              {invoices.filter(i => i.status === 'overdue').map(inv => {
                const prob = probScore(inv.client_name)
                const days = daysPast(inv.due_date)
                return (
                  <div key={inv.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink)' }}>{inv.client_name}</p>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.6rem', fontWeight: 800, background: prob.bg, color: prob.color }}>{prob.label}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--mu)' }}>
                        {inv.invoice_number} · ${getBalance(inv).toFixed(2)} · <span style={{ color: '#ef4444', fontWeight: 700 }}>{days}d overdue</span>
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => toast.success(`Reminder sent to ${inv.client_email || inv.client_name} 📨`)}
                        style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
                        Send Reminder
                      </button>
                      <button onClick={() => openEdit(inv)}
                        style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
                        Record Payment
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Revenue Analytics ── */}
        <motion.div className="glass-card" style={{ padding: 20, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <h2 style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Revenue Collected (Last 6 Months)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueByMonth} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--mu)' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="amount" name="Revenue" fill="#6366f1" radius={[5,5,0,0]} animationBegin={300} animationDuration={700} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* ── Search + Filters + View Toggle ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 240, height: 36 }} placeholder="🔍 Search invoices..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            {FILTER_PILLS.map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                style={{ padding: '5px 12px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: statusFilter === f.key ? '#6366f1' : 'var(--bg3)', color: statusFilter === f.key ? '#fff' : 'var(--mu)' }}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['table','board'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, background: view === v ? '#6366f1' : 'var(--bg3)', color: view === v ? '#fff' : 'var(--mu)', transition: 'all 0.15s' }}>
                {v === 'table' ? '☰ Table' : '🗂 Board'}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--mu)', whiteSpace: 'nowrap' }}>{filtered.length} invoices</span>
        </div>

        {/* ── Empty State ── */}
        {invoices.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🧾</span>
            <h3>No invoices yet</h3>
            <p>Create your first invoice to start tracking money owed to your business.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={openNew}>Create First Invoice</button>
              <button className="btn-ghost" onClick={() => toast('Payment setup coming soon 💳')}>Set Up Payments</button>
              <button className="btn-ghost" onClick={() => toast('Email configuration coming soon 📧')}>Configure Email</button>
            </div>
          </div>
        )}

        {/* ── TABLE VIEW ── */}
        {view === 'table' && filtered.length > 0 && (
          <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-base" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    {['Invoice #','Client','Amount','Paid','Balance','Status','Due Date','Days Out','Actions'].map(h => (
                      <th key={h} style={{ paddingLeft: h === 'Invoice #' ? 20 : undefined }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const total = getTotal(inv)
                    const balance = getBalance(inv)
                    const paid = inv.amount_paid ?? 0
                    const days = inv.status === 'overdue' ? daysPast(inv.due_date) : 0
                    return (
                      <tr key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)} style={{ cursor: 'pointer' }}>
                        <td style={{ paddingLeft: 20 }}>
                          <span style={{ fontFamily: `DM Mono, monospace`, fontWeight: 700, fontSize: '0.8rem', color: '#6366f1' }}>{inv.invoice_number}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#6366f1', flexShrink: 0 }}>
                              {initials(inv.client_name)}
                            </div>
                            <div>
                              <p style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--ink)' }}>{inv.client_name}</p>
                              {inv.client_email && <p style={{ fontSize: '0.65rem', color: 'var(--mu)' }}>{inv.client_email}</p>}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontFamily: `DM Mono, monospace`, fontWeight: 600, fontSize: '0.8rem', color: 'var(--ink)' }}>${total.toFixed(2)}</td>
                        <td style={{ fontFamily: `DM Mono, monospace`, fontWeight: 600, fontSize: '0.8rem', color: '#10b981' }}>${paid.toFixed(2)}</td>
                        <td style={{ fontFamily: `DM Mono, monospace`, fontWeight: 600, fontSize: '0.8rem', color: balance > 0 ? '#f59e0b' : 'var(--mu)' }}>${balance.toFixed(2)}</td>
                        <td><StatusBadge status={inv.status} /></td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--mu)' }}>{format(new Date(inv.due_date), 'MMM d, yyyy')}</td>
                        <td style={{ fontSize: '0.75rem', color: days > 0 ? '#ef4444' : 'var(--mu)', fontWeight: days > 0 ? 700 : 400 }}>
                          {days > 0 ? `${days}d` : '—'}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => router.push(`/invoices/${inv.id}`)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.65rem' }}>View</button>
                            <button onClick={() => openEdit(inv)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.65rem' }}>Edit</button>
                            <button onClick={() => toast.success(`Reminder sent to ${inv.client_name} 📨`)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.65rem' }}>Send</button>
                            <button onClick={() => deleteInvoice(inv.id)} style={{ padding: '4px 8px', fontSize: '0.65rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', borderRadius: 6 }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── BOARD VIEW ── */}
        {view === 'board' && invoices.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BOARD_COLS.length},1fr)`, gap: 12, overflowX: 'auto' }}>
            {BOARD_COLS.map(col => {
              const colInvs = filtered.filter(i => i.status === col)
              const cfg = STATUS_CONFIG[col]
              return (
                <div key={col} style={{ minWidth: 180, background: 'var(--bg3)', borderRadius: 14, padding: '12px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: cfg.color }}>{cfg.label}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--mu)', background: 'var(--bg4)', padding: '2px 8px', borderRadius: 99 }}>{colInvs.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {colInvs.map(inv => (
                      <div key={inv.id} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', border: `1px solid ${cfg.border}`, cursor: 'pointer', transition: 'all 0.15s' }}
                        onClick={() => router.push(`/invoices/${inv.id}`)}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>
                        <p style={{ fontWeight: 700, fontSize: '0.75rem', color: '#6366f1', fontFamily: `DM Mono, monospace`, marginBottom: 4 }}>{inv.invoice_number}</p>
                        <p style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--ink)', marginBottom: 4 }}>{inv.client_name}</p>
                        <p style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--ink)', fontFamily: `DM Mono, monospace` }}>${getTotal(inv).toFixed(2)}</p>
                        <p style={{ fontSize: '0.65rem', color: 'var(--mu)', marginTop: 4 }}>Due {format(new Date(inv.due_date), 'MMM d')}</p>
                        <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {ALL_STATUSES.filter(s => s !== col).slice(0, 2).map(s => (
                            <button key={s} onClick={e => { e.stopPropagation(); quickStatus(inv.id, s) }}
                              style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--bg3)', color: 'var(--mu)', transition: 'all 0.15s' }}>
                              → {STATUS_CONFIG[s]?.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {colInvs.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--mu2)', fontSize: '0.7rem' }}>No invoices</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* ── Invoice Drawer ── */}
      <InvoiceDrawer
        open={drawer !== null}
        mode={drawer}
        invoice={selectedInvoice}
        clients={clients}
        userId={userId}
        onClose={() => { setDrawer(null); setSelectedInvoice(null) }}
        onSaved={load}
      />

      {/* ── Learn Panel ── */}
      <AnimatePresence>
        {learnLabel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setLearnLabel(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 849 }} />
            <LearnPanel label={learnLabel} onClose={() => setLearnLabel(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
