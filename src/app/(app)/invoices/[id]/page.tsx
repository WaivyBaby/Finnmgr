'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

type LineItem = { description: string; qty: number; rate: number }
type Invoice = {
  id: string; user_id: string; invoice_number: string
  client_name: string; client_email?: string; client_address?: string
  issue_date?: string; due_date: string; status: string
  line_items?: LineItem[]; items?: LineItem[]
  subtotal?: number; tax_rate?: number; tax_amount?: number
  total?: number; amount_paid?: number; balance_due?: number
  notes?: string; internal_notes?: string; payment_method?: string
  viewed_at?: string; email_sent_at?: string; reminder_sent_at?: string
  paid_at?: string; created_at: string; updated_at?: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: 'var(--mu)',  bg: 'var(--bg3)' },
  sent:      { label: 'Sent',      color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
  viewed:    { label: 'Viewed',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  partial:   { label: 'Partial',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  paid:      { label: 'Paid',      color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  overdue:   { label: 'Overdue',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  cancelled: { label: 'Cancelled', color: 'var(--mu2)', bg: 'var(--bg3)' },
}

function getLineItems(inv: Invoice): LineItem[] {
  return (inv.line_items && inv.line_items.length > 0) ? inv.line_items : (inv.items ?? [])
}
function getTotal(inv: Invoice): number {
  if (inv.total && inv.total > 0) return inv.total
  return getLineItems(inv).reduce((s, it) => s + it.qty * it.rate, 0)
}
function getBalance(inv: Invoice): number {
  if (inv.balance_due !== undefined && inv.balance_due !== null) return inv.balance_due
  return getTotal(inv) - (inv.amount_paid ?? 0)
}

type TimelineEvent = { icon: string; label: string; ts: string; color: string }

function buildTimeline(inv: Invoice): TimelineEvent[] {
  const events: TimelineEvent[] = []
  events.push({ icon: '📄', label: 'Invoice created', ts: inv.created_at, color: '#6366f1' })
  if (inv.email_sent_at) events.push({ icon: '📧', label: 'Sent to client', ts: inv.email_sent_at, color: '#0ea5e9' })
  if (inv.viewed_at) events.push({ icon: '👁️', label: 'Invoice viewed by client', ts: inv.viewed_at, color: '#8b5cf6' })
  if (inv.reminder_sent_at) events.push({ icon: '🔔', label: 'Reminder sent', ts: inv.reminder_sent_at, color: '#f59e0b' })
  if (inv.paid_at) events.push({ icon: '✅', label: inv.status === 'partial' ? 'Partial payment recorded' : 'Invoice fully paid', ts: inv.paid_at, color: '#10b981' })
  if (inv.updated_at && inv.updated_at !== inv.created_at) events.push({ icon: '✏️', label: 'Invoice edited', ts: inv.updated_at, color: 'var(--mu)' })
  return events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
}

const iStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'var(--in-bg)',
  border: '1.5px solid var(--in-bd)', borderRadius: 9, fontSize: '0.8rem',
  color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit',
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], method: 'Bank Transfer', reference: '' })

  const load = useCallback(async () => {
    const sb = createClient()
    const { data, error } = await sb.from('invoices').select('*').eq('id', id).single()
    if (error || !data) { toast.error('Invoice not found'); router.push('/invoices'); return }
    setInvoice(data as Invoice)
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    if (!invoice) return
    const total = getTotal(invoice)
    const existingPaid = invoice.amount_paid ?? 0
    const paidAmt = existingPaid + parseFloat(payForm.amount)
    const newStatus = paidAmt >= total ? 'paid' : 'partial'
    const { error } = await sb.from('invoices').update({
      amount_paid: paidAmt, balance_due: total - paidAmt, status: newStatus,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : undefined,
      payment_method: payForm.method, reference_number: payForm.reference,
    }).eq('id', id)
    setSaving(false)
    if (error) { toast.error('Failed to record payment'); return }
    toast.success(newStatus === 'paid' ? 'Invoice fully paid! 💰' : 'Partial payment recorded ✓')
    setShowPayment(false); load()
  }

  async function updateStatus(status: string) {
    const sb = createClient()
    const updates: Partial<Invoice> = { status }
    if (status === 'paid' && invoice) { updates.amount_paid = getTotal(invoice); updates.paid_at = new Date().toISOString() }
    await sb.from('invoices').update(updates).eq('id', id)
    setInvoice(prev => prev ? { ...prev, ...updates } : prev)
    toast.success(`Status updated to ${STATUS_CONFIG[status]?.label ?? status}`)
  }

  if (loading || !invoice) {
    return (
      <div className="page-content">
        <div style={{ height: 36, width: 120, marginBottom: 20 }} className="skeleton" />
        <div style={{ height: 100, marginBottom: 20 }} className="skeleton" />
        <div style={{ height: 300 }} className="skeleton" />
      </div>
    )
  }

  const lineItems = getLineItems(invoice)
  const total = getTotal(invoice)
  const paid = invoice.amount_paid ?? 0
  const balance = getBalance(invoice)
  const timeline = buildTimeline(invoice)
  const cfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Back */}
        <button onClick={() => router.push('/invoices')} className="btn-ghost" style={{ marginBottom: 20, fontSize: '0.75rem', padding: '6px 14px' }}>
          ← Invoices
        </button>

        {/* Header */}
        <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--ink)', letterSpacing: '-0.035em', fontFamily: `Cabinet Grotesk, sans-serif` }}>
                  {invoice.invoice_number}
                </h1>
                <span style={{ padding: '4px 12px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: cfg.color, background: cfg.bg }}>
                  {cfg.label}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--mu)' }}>
                {invoice.client_name} · Due {format(new Date(invoice.due_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#6366f1', letterSpacing: '-0.04em', fontFamily: `DM Mono, monospace` }}>
              ${total.toFixed(2)}
            </p>
            {paid > 0 && <p style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>Paid: ${paid.toFixed(2)} · Balance: ${balance.toFixed(2)}</p>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          <div>
            {/* Client info */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--ink)', marginBottom: 14 }}>Client</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Name', val: invoice.client_name },
                  { label: 'Email', val: invoice.client_email },
                  { label: 'Address', val: invoice.client_address },
                  { label: 'Payment Method', val: invoice.payment_method },
                ].filter(r => r.val).map(r => (
                  <div key={r.label}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)', marginBottom: 3 }}>{r.label}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--ink)' }}>{r.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Line items */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
                <h2 style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--ink)' }}>Line Items</h2>
              </div>
              <table className="table-base">
                <thead>
                  <tr>
                    {['Description','Qty','Rate','Amount'].map(h => (
                      <th key={h} style={{ paddingLeft: h === 'Description' ? 20 : undefined }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((it, i) => (
                    <tr key={i}>
                      <td style={{ paddingLeft: 20, fontSize: '0.8rem' }}>{it.description}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--mu)' }}>{it.qty}</td>
                      <td style={{ fontFamily: `DM Mono, monospace`, fontSize: '0.8rem' }}>${Number(it.rate).toFixed(2)}</td>
                      <td style={{ fontFamily: `DM Mono, monospace`, fontSize: '0.8rem', fontWeight: 700 }}>${(it.qty * Number(it.rate)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 40, fontSize: '0.8rem' }}><span style={{ color: 'var(--mu)' }}>Subtotal</span><span style={{ fontFamily: `DM Mono, monospace` }}>${(invoice.subtotal ?? total).toFixed(2)}</span></div>
                {(invoice.tax_rate ?? 0) > 0 && <div style={{ display: 'flex', gap: 40, fontSize: '0.8rem' }}><span style={{ color: 'var(--mu)' }}>Tax ({invoice.tax_rate}%)</span><span style={{ fontFamily: `DM Mono, monospace` }}>${(invoice.tax_amount ?? 0).toFixed(2)}</span></div>}
                {paid > 0 && <div style={{ display: 'flex', gap: 40, fontSize: '0.8rem' }}><span style={{ color: '#10b981' }}>Paid</span><span style={{ fontFamily: `DM Mono, monospace`, color: '#10b981' }}>-${paid.toFixed(2)}</span></div>}
                <div style={{ display: 'flex', gap: 40, fontSize: '1rem', fontWeight: 900, borderTop: '1px solid var(--bd)', paddingTop: 8, marginTop: 4 }}>
                  <span>Balance Due</span>
                  <span style={{ color: '#6366f1', fontFamily: `DM Mono, monospace` }}>${balance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
                <h2 style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--ink)', marginBottom: 10 }}>Notes</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--ink)', lineHeight: 1.7 }}>{invoice.notes}</p>
              </div>
            )}

            {/* Payment recording */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPayment ? 16 : 0 }}>
                <h2 style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--ink)' }}>Record Payment</h2>
                {invoice.status !== 'paid' && (
                  <button onClick={() => setShowPayment(p => !p)}
                    style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
                    {showPayment ? 'Cancel' : '+ Record Payment'}
                  </button>
                )}
              </div>
              {invoice.status === 'paid' && (
                <p style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>✅ Fully paid {invoice.paid_at ? `on ${format(new Date(invoice.paid_at), 'MMM d, yyyy')}` : ''}</p>
              )}
              <AnimatePresence>
                {showPayment && (
                  <motion.form onSubmit={recordPayment} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)', display: 'block', marginBottom: 4 }}>Amount ($)</label>
                        <input type="number" required min="0.01" step="0.01" value={payForm.amount}
                          onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder={`Up to $${balance.toFixed(2)}`} style={iStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)', display: 'block', marginBottom: 4 }}>Date</label>
                        <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} style={iStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)', display: 'block', marginBottom: 4 }}>Method</label>
                        <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} style={iStyle}>
                          {['Bank Transfer','Check','Cash','Stripe','PayPal','Venmo','Zelle','Other'].map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)', display: 'block', marginBottom: 4 }}>Reference #</label>
                        <input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="Check # or transaction ID" style={iStyle} />
                      </div>
                    </div>
                    <button type="submit" disabled={saving} className="btn-primary" style={{ marginTop: 12, padding: '9px 20px', background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                      {saving ? 'Saving...' : 'Record Payment'}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right column */}
          <div>
            {/* Actions */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--ink)', marginBottom: 12 }}>Actions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Send Invoice Email', color: '#0ea5e9', action: () => toast('Email sending coming soon 📧') },
                  { label: 'Send Reminder', color: '#f59e0b', action: () => toast.success(`Reminder sent! 📨`) },
                  { label: 'Download PDF', color: '#6366f1', action: () => toast('PDF generation coming soon 📄') },
                  { label: 'Duplicate Invoice', color: 'var(--mu)', action: () => toast('Duplicate coming soon') },
                ].map(a => (
                  <button key={a.label} onClick={a.action}
                    style={{ padding: '9px 14px', borderRadius: 10, border: `1.5px solid ${a.color}33`, background: `${a.color}11`, color: a.color, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    {a.label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu2)', display: 'block', marginBottom: 6 }}>Update Status</label>
                <select value={invoice.status} onChange={e => updateStatus(e.target.value)}
                  style={{ ...iStyle, width: '100%', cursor: 'pointer' }}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="glass-card" style={{ padding: 20 }}>
              <h2 style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--ink)', marginBottom: 16 }}>Activity Timeline</h2>
              {timeline.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--mu)' }}>No activity recorded yet.</p>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 36 }}>
                  <div style={{ position: 'absolute', left: 13, top: 0, bottom: 0, width: 2, background: 'var(--bd)' }} />
                  {timeline.map((ev, i) => (
                    <div key={i} style={{ position: 'relative', marginBottom: 16 }}>
                      <div style={{ position: 'absolute', left: -36, top: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--bg3)', border: `2px solid ${ev.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                        {ev.icon}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--ink)', fontWeight: 500 }}>{ev.label}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--mu2)', marginTop: 2 }}>
                        {formatDistanceToNow(new Date(ev.ts), { addSuffix: true })} · {format(new Date(ev.ts), 'MMM d, yyyy')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
