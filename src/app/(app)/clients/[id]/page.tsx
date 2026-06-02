'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/* ── Types ── */
type Client = {
  id: string; user_id: string; name: string; email?: string; phone?: string
  company?: string; total_billed: number; total_paid: number; invoice_count: number
  status: string; avatar_color: string; created_at: string; updated_at?: string
  payment_terms?: string; tags?: string[]; website?: string; industry?: string
  notes?: string; address?: string; client_group?: string; archived_at?: string
}
type Invoice = {
  id: string; invoice_number: string; status: string; total: number; balance_due: number
  due_date?: string; paid_at?: string; created_at: string; updated_at?: string; client_name: string
}
type Tab = 'overview' | 'invoices' | 'timeline' | 'notes' | 'documents'
type TimelineEvent = { icon: string; desc: string; ts: string }

/* ── Constants ── */
const STATUS_MAP: Record<string, string> = {
  lead: 'status-draft', client: 'status-paid', vip: 'status-viewed',
  recurring: 'status-sent', inactive: 'status-cancelled', 'at-risk': 'status-overdue',
}
const STATUS_LABELS = ['lead', 'client', 'vip', 'recurring', 'inactive', 'at-risk']
const INDUSTRIES = ['Technology', 'Marketing', 'Design', 'Consulting', 'Healthcare', 'Finance', 'Legal', 'Real Estate', 'Education', 'E-commerce', 'Other']
const PAYMENT_TERMS = ['Due Upon Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 60', 'Custom']
const TAG_PRESETS = ['High Value', 'Monthly', 'Late Payer', 'Priority', 'Needs Follow Up']

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/* ── Health score ── */
function computeHealthScore(client: Client, invoices: Invoice[]): number {
  let score = 55
  const totalBilled = Number(client.total_billed)
  const totalPaid = Number(client.total_paid)

  // Payment completion: up to +25
  if (totalBilled > 0) score += Math.round((totalPaid / totalBilled) * 25)

  // Invoice volume bonus
  if (invoices.length >= 3) score += 5
  if (invoices.length >= 10) score += 5

  // Overdue penalty: -15 each, max -30
  const overdueCount = invoices.filter(i => i.status === 'overdue').length
  score -= Math.min(overdueCount * 15, 30)

  // Outstanding balance ratio: up to -15
  if (totalBilled > 0) score -= Math.round(((totalBilled - totalPaid) / totalBilled) * 15)

  // Status modifier
  const mods: Record<string, number> = { vip: 10, recurring: 8, client: 0, lead: -5, inactive: -15, 'at-risk': -25 }
  score += mods[client.status] ?? 0

  return Math.max(0, Math.min(100, score))
}

function healthMeta(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: '#10b981' }
  if (score >= 60) return { label: 'Good', color: '#0ea5e9' }
  if (score >= 40) return { label: 'Fair', color: '#f59e0b' }
  return { label: 'At Risk', color: '#ef4444' }
}

function computeAvgPaymentDays(invoices: Invoice[]): number | null {
  const paid = invoices.filter(i => i.status === 'paid' && i.paid_at)
  if (paid.length === 0) return null
  const total = paid.reduce((s, inv) => {
    const days = (new Date(inv.paid_at!).getTime() - new Date(inv.created_at).getTime()) / 86400000
    return s + Math.max(0, days)
  }, 0)
  return Math.round(total / paid.length)
}

function buildTrend(invoices: Invoice[]) {
  const counts: Record<string, number> = {}
  invoices.forEach(inv => {
    const d = new Date(inv.created_at)
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    counts[key] = (counts[key] ?? 0) + Number(inv.total)
  })
  return Object.entries(counts).map(([label, amount]) => ({ label, amount }))
}

function buildTimeline(client: Client, invoices: Invoice[]): TimelineEvent[] {
  const events: TimelineEvent[] = []
  events.push({ icon: '🎉', desc: `${client.name} added as a client`, ts: client.created_at })
  invoices.forEach(inv => {
    events.push({ icon: '🧾', desc: `Invoice ${inv.invoice_number} created ($${Number(inv.total).toFixed(2)})`, ts: inv.created_at })
    if (inv.status === 'paid' && inv.paid_at) {
      events.push({ icon: '✅', desc: `Invoice ${inv.invoice_number} marked paid`, ts: inv.paid_at })
    } else if (inv.status === 'sent' && inv.updated_at) {
      events.push({ icon: '📨', desc: `Invoice ${inv.invoice_number} sent to ${client.email ?? 'client'}`, ts: inv.updated_at })
    } else if (inv.status === 'overdue') {
      events.push({ icon: '⚠️', desc: `Invoice ${inv.invoice_number} is overdue`, ts: inv.updated_at ?? inv.created_at })
    }
  })
  if (client.notes) {
    events.push({ icon: '📝', desc: 'Note added to client profile', ts: client.updated_at ?? client.created_at })
  }
  return events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 11 }}>
      <p style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#10b981' }}>Revenue: ${Number(payload[0].value).toFixed(2)}</p>
    </div>
  )
}

/* ── Edit Drawer ── */
function EditDrawer({ open, onClose, client, onSaved }: {
  open: boolean; onClose: () => void; client: Client; onSaved: (c: Client) => void
}) {
  const [form, setForm] = useState({
    name: client.name, company: client.company ?? '', email: client.email ?? '',
    phone: client.phone ?? '', address: client.address ?? '', website: client.website ?? '',
    industry: client.industry ?? '', status: client.status,
    payment_terms: client.payment_terms ?? 'Net 30', tags: client.tags ?? [],
    notes: client.notes ?? '', client_group: client.client_group ?? '',
  })
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      name: client.name, company: client.company ?? '', email: client.email ?? '',
      phone: client.phone ?? '', address: client.address ?? '', website: client.website ?? '',
      industry: client.industry ?? '', status: client.status,
      payment_terms: client.payment_terms ?? 'Net 30', tags: client.tags ?? [],
      notes: client.notes ?? '', client_group: client.client_group ?? '',
    })
    setTagInput('')
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, client, onClose])

  function addTag(preset?: string) {
    const val = (preset ?? tagInput).trim().replace(/,/g, '')
    if (val && !form.tags.includes(val)) setForm(f => ({ ...f, tags: [...f.tags, val] }))
    if (!preset) setTagInput('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { data, error } = await sb.from('clients').update(form).eq('id', client.id).select().single()
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    toast.success('Client updated ✓'); onSaved(data as Client)
  }

  const iStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }
  const lStyle: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu)', display: 'block' }

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
              <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Edit Client</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22 }}>×</button>
            </div>
            <form onSubmit={submit} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}><label style={lStyle}>Full Name *</label><input style={iStyle} required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label style={lStyle}>Company</label><input style={iStyle} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
                <div><label style={lStyle}>Industry</label>
                  <select style={iStyle} value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
                    <option value="">Select...</option>
                    {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div><label style={lStyle}>Email *</label><input style={iStyle} type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label style={lStyle}>Phone</label><input style={iStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={lStyle}>Website</label><input style={iStyle} value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={lStyle}>Address</label><input style={iStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={lStyle}>Group</label><input style={iStyle} placeholder="e.g. Enterprise, Agency" value={form.client_group} onChange={e => setForm(f => ({ ...f, client_group: e.target.value }))} /></div>
                <div>
                  <label style={lStyle}>Status</label>
                  <select style={iStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_LABELS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Payment Terms</label>
                  <select style={iStyle} value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                    {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Tags</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 8 }}>
                    {TAG_PRESETS.map(p => {
                      const active = form.tags.includes(p)
                      return (
                        <button key={p} type="button"
                          onClick={() => active ? setForm(f => ({ ...f, tags: f.tags.filter(x => x !== p) })) : addTag(p)}
                          style={{ padding: '4px 11px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', border: `1.5px solid ${active ? '#6366f1' : 'var(--bd2)'}`, background: active ? 'rgba(99,102,241,0.14)' : 'var(--bg3)', color: active ? '#6366f1' : 'var(--mu)' }}>
                          {active ? '✓ ' : ''}{p}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...iStyle, marginTop: 0, flex: 1 }} placeholder="Custom tag, press Enter" value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }} />
                    <button type="button" onClick={() => addTag()} className="btn-ghost" style={{ padding: '9px 14px' }}>Add</button>
                  </div>
                  {form.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {form.tags.map(t => (
                        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontSize: 11, fontWeight: 600 }}>
                          {t}
                          <button type="button" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lStyle}>Notes</label>
                  <textarea style={{ ...iStyle, height: 80, resize: 'none', lineHeight: 1.6 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </form>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 10 }}>
              <button onClick={submit as unknown as React.MouseEventHandler} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '12px 20px' }}>Cancel</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ══════════════════════════════════════════════════
   CLIENT PROFILE PAGE
══════════════════════════════════════════════════ */
export default function ClientProfilePage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [emailLogged, setEmailLogged] = useState(false)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data: c, error } = await sb.from('clients').select('*').eq('id', id).single()
    if (error || !c) { toast.error('Client not found'); router.push('/clients'); return }
    setClient(c as Client)
    const { data: invData } = await sb.from('invoices').select('*').eq('user_id', user.id).eq('client_name', c.name).order('created_at', { ascending: false })
    setInvoices(invData ?? [])
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function saveNote() {
    if (!noteText.trim() || !client) return
    setSavingNote(true)
    const sb = createClient()
    const ts = format(new Date(), 'MMM d, yyyy')
    const newNotes = client.notes
      ? `${client.notes}\n\n[${ts}]\n${noteText.trim()}`
      : `[${ts}]\n${noteText.trim()}`
    const { error } = await sb.from('clients').update({ notes: newNotes }).eq('id', client.id)
    setSavingNote(false)
    if (error) { toast.error('Failed to save note'); return }
    setClient(c => c ? { ...c, notes: newNotes } : c)
    setNoteText('')
    toast.success('Note saved ✓')
  }

  async function deleteNote(displayIndex: number) {
    if (!client?.notes) return
    const blocks = client.notes.split('\n\n').filter(Boolean)
    const actualIndex = blocks.length - 1 - displayIndex
    const newBlocks = blocks.filter((_, i) => i !== actualIndex)
    const newNotes = newBlocks.join('\n\n')
    const sb = createClient()
    const { error } = await sb.from('clients').update({ notes: newNotes || null }).eq('id', client.id)
    if (error) { toast.error('Failed to delete note'); return }
    setClient(c => c ? { ...c, notes: newNotes || undefined } : c)
    toast.success('Note deleted')
  }

  async function archiveClient() {
    if (!client) return
    setArchiving(true)
    const sb = createClient()
    const archived_at = client.archived_at ? null : new Date().toISOString()
    const { error } = await sb.from('clients').update({ archived_at }).eq('id', client.id)
    setArchiving(false)
    if (error) { toast.error('Failed to update'); return }
    if (archived_at) {
      toast.success(`${client.name} archived`)
      router.push('/clients')
    } else {
      setClient(c => c ? { ...c, archived_at: undefined } : c)
      toast.success(`${client.name} restored`)
    }
  }

  function openEmail() {
    if (!client?.email) { toast.error('No email address on file'); return }
    try {
      window.open(`mailto:${client.email}`, '_self')
    } catch {
      navigator.clipboard.writeText(client.email)
        .then(() => toast.success(`Email copied: ${client.email}`))
        .catch(() => toast(`Email: ${client.email}`))
    }
  }

  function copyEmail() {
    if (!client?.email) return
    navigator.clipboard.writeText(client.email)
      .then(() => toast.success('Email copied to clipboard'))
      .catch(() => toast(`Email: ${client.email}`))
  }

  async function logEmailContact() {
    if (!client) return
    const ts = format(new Date(), 'MMM d, yyyy')
    const entry = `[${ts}]\nEmail contact logged`
    const newNotes = client.notes ? `${client.notes}\n\n${entry}` : entry
    const sb = createClient()
    await sb.from('clients').update({ notes: newNotes }).eq('id', client.id)
    setClient(c => c ? { ...c, notes: newNotes } : c)
    setEmailLogged(true)
    toast.success('Email contact logged ✓')
    setTimeout(() => setEmailLogged(false), 3000)
  }

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 36, width: 120, marginBottom: 24 }} className="skeleton" />
        <div style={{ height: 100, marginBottom: 24 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[...Array(6)].map((_, i) => <div key={i} style={{ height: 80 }} className="skeleton" />)}
        </div>
        <div style={{ height: 300 }} className="skeleton" />
      </div>
    )
  }

  if (!client) return null

  /* Derived stats */
  const paidInvoices = invoices.filter(i => i.status === 'paid')
  const overdueInvoices = invoices.filter(i => i.status === 'overdue')
  const totalRevenue = invoices.reduce((s, i) => s + Number(i.total), 0)
  const outstanding = invoices.reduce((s, i) => s + Math.max(0, Number(i.balance_due)), 0)
  const avgInvoice = invoices.length > 0 ? totalRevenue / invoices.length : 0
  const trendData = buildTrend(invoices)
  const timeline = buildTimeline(client, invoices)
  const noteBlocks = client.notes ? client.notes.split('\n\n').filter(Boolean) : []
  const noteCards = [...noteBlocks].reverse()

  const healthScore = computeHealthScore(client, invoices)
  const { label: healthLabel, color: healthColor } = healthMeta(healthScore)
  const avgPayDays = computeAvgPaymentDays(invoices)
  const lastInvoice = invoices[0]

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'invoices', label: `Invoices (${invoices.length})` },
    { key: 'timeline', label: 'Timeline' },
    { key: 'notes', label: `Notes${noteCards.length > 0 ? ` (${noteCards.length})` : ''}` },
    { key: 'documents', label: 'Documents' },
  ]

  const iStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit' }

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* Back */}
        <button onClick={() => router.push('/clients')} className="btn-ghost" style={{ marginBottom: 20, fontSize: 12, padding: '6px 14px' }}>
          ← Clients
        </button>

        {/* ── Profile Hero ── */}
        <div className="glass-card" style={{ padding: '24px 28px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: client.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 22, fontWeight: 900 }}>{initials(client.name)}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.035em' }}>{client.name}</h1>
                <span className={`status-pill ${STATUS_MAP[client.status] ?? 'status-draft'}`}>{client.status}</span>
                {client.archived_at && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 99, background: 'var(--bg3)', color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Archived</span>
                )}
              </div>
              {client.company && <p style={{ color: 'var(--mu)', fontSize: 14, marginTop: 2 }}>{client.company}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                <p style={{ color: 'var(--mu2)', fontSize: 11 }}>
                  Client since {format(new Date(client.created_at), 'MMM d, yyyy')}
                </p>
                {client.client_group && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                    {client.client_group}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => setEditOpen(true)}>Edit Client</button>
              <button className="btn-ghost" onClick={() => router.push(`/invoices?client=${encodeURIComponent(client.name)}`)}>Create Invoice</button>
              {client.email && (
                <button className="btn-ghost" onClick={openEmail} title={client.email}>✉️ Email</button>
              )}
              <button className="btn-ghost" onClick={archiveClient} disabled={archiving}
                style={{ color: client.archived_at ? '#10b981' : undefined }}>
                {archiving ? '...' : client.archived_at ? 'Restore' : 'Archive'}
              </button>
            </div>
          </div>
        </div>

        {/* ── 6 Quick stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Total Revenue',    value: `$${Number(client.total_billed).toFixed(2)}`,    color: '#10b981', icon: '💰' },
            { label: 'Outstanding',      value: `$${outstanding.toFixed(2)}`,                    color: outstanding > 0 ? '#f59e0b' : '#10b981', icon: '⏳' },
            { label: 'Total Invoices',   value: String(invoices.length),                         color: '#6366f1', icon: '🧾' },
            { label: 'Health Score',     value: `${healthScore}`,                                color: healthColor, icon: '❤️', sub: healthLabel },
            { label: 'Avg Payment Days', value: avgPayDays !== null ? `${avgPayDays}d` : '—',    color: avgPayDays !== null && avgPayDays <= 30 ? '#10b981' : '#f59e0b', icon: '⏱️' },
            { label: 'Last Invoice',     value: lastInvoice ? format(new Date(lastInvoice.created_at), 'MMM d') : '—', color: 'var(--ink)', icon: '📅' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>{s.value}</div>
              {'sub' in s && s.sub && <div className="stat-sub" style={{ color: s.color, fontWeight: 700 }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--bd)', marginBottom: 20, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', fontWeight: activeTab === t.key ? 700 : 500, color: activeTab === t.key ? '#6366f1' : 'var(--mu)', borderBottom: activeTab === t.key ? '2px solid #6366f1' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Contact info */}
                  <div className="glass-card" style={{ padding: 24 }}>
                    <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Contact Info</h2>
                    {[
                      { label: 'Email', val: client.email },
                      { label: 'Phone', val: client.phone },
                      { label: 'Address', val: client.address },
                      { label: 'Website', val: client.website },
                      { label: 'Industry', val: client.industry },
                      { label: 'Payment Terms', val: client.payment_terms },
                      { label: 'Group', val: client.client_group },
                    ].map(row => row.val ? (
                      <div key={row.label} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mu2)', minWidth: 110, paddingTop: 1 }}>{row.label}</span>
                        <span style={{ fontSize: 13, color: 'var(--ink)', wordBreak: 'break-word' }}>{row.val}</span>
                      </div>
                    ) : null)}
                    {(client.tags ?? []).length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {(client.tags ?? []).map(t => (
                          <span key={t} style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontSize: 11, fontWeight: 600 }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes preview */}
                  <div className="glass-card" style={{ padding: 24 }}>
                    <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Recent Notes</h2>
                    {noteCards.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.7 }}>No notes yet. Add notes in the Notes tab.</p>
                    ) : (
                      noteCards.slice(0, 2).map((note, i) => (
                        <div key={i} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10, marginBottom: 10, fontSize: 12, color: 'var(--ink)', lineHeight: 1.7 }}>
                          {note}
                        </div>
                      ))
                    )}
                    {noteCards.length > 2 && (
                      <button onClick={() => setActiveTab('notes')} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                        View all {noteCards.length} notes →
                      </button>
                    )}
                  </div>
                </div>

                {/* Email section */}
                {client.email && (
                  <div className="glass-card" style={{ padding: 20 }}>
                    <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 14 }}>Email</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✉️</div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{client.email}</p>
                          <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 1 }}>Primary email address</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-primary" onClick={openEmail} style={{ padding: '8px 16px', fontSize: 12 }}>Open in Mail</button>
                        <button className="btn-ghost" onClick={copyEmail} style={{ padding: '8px 14px', fontSize: 12 }}>Copy</button>
                        <button className="btn-ghost" onClick={logEmailContact} style={{ padding: '8px 14px', fontSize: 12, color: emailLogged ? '#10b981' : undefined }}>
                          {emailLogged ? '✓ Logged' : 'Log Contact'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── INVOICES ── */}
            {activeTab === 'invoices' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
                  {[
                    { label: 'Total Revenue',   value: `$${totalRevenue.toFixed(2)}`,     color: '#10b981' },
                    { label: 'Outstanding',      value: `$${outstanding.toFixed(2)}`,      color: outstanding > 0 ? '#f59e0b' : '#10b981' },
                    { label: 'Paid Invoices',    value: String(paidInvoices.length),       color: '#10b981' },
                    { label: 'Overdue',          value: String(overdueInvoices.length),    color: overdueInvoices.length > 0 ? '#ef4444' : 'var(--mu)' },
                    { label: 'Total Invoices',   value: String(invoices.length),           color: '#6366f1' },
                    { label: 'Avg Invoice',      value: `$${avgInvoice.toFixed(2)}`,       color: '#8b5cf6' },
                  ].map(s => (
                    <div key={s.label} className="stat-card">
                      <div className="stat-label">{s.label}</div>
                      <div className="stat-value" style={{ color: s.color, fontSize: 18 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {trendData.length > 0 && (
                  <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', marginBottom: 16 }}>Revenue Trend</h2>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} tickFormatter={v => `$${v}`} />
                        <Tooltip content={<ChartTip />} />
                        <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} animationDuration={700} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
                    <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>Invoice History</h2>
                  </div>
                  {invoices.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--mu)' }}>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>No invoices yet for {client.name}</p>
                      <button className="btn-primary" style={{ marginTop: 12 }}
                        onClick={() => router.push(`/invoices?client=${encodeURIComponent(client.name)}`)}>
                        Create Invoice →
                      </button>
                    </div>
                  ) : (
                    <table className="table-base">
                      <thead>
                        <tr>
                          <th style={{ paddingLeft: 20 }}>Invoice #</th>
                          <th>Status</th>
                          <th>Amount</th>
                          <th>Due Date</th>
                          <th>Paid Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map(inv => (
                          <tr key={inv.id}>
                            <td style={{ paddingLeft: 20 }}>
                              <span style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 600 }}>{inv.invoice_number}</span>
                            </td>
                            <td><span className={`status-pill status-${inv.status}`}>{inv.status}</span></td>
                            <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 600, color: '#10b981' }}>${Number(inv.total).toFixed(2)}</td>
                            <td style={{ color: 'var(--mu)', fontSize: 12 }}>{inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}</td>
                            <td style={{ color: 'var(--mu)', fontSize: 12 }}>{inv.paid_at ? format(new Date(inv.paid_at), 'MMM d, yyyy') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── TIMELINE ── */}
            {activeTab === 'timeline' && (
              <div className="glass-card" style={{ padding: 24 }}>
                <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', marginBottom: 20 }}>Activity Timeline</h2>
                {timeline.length === 0 ? (
                  <p style={{ color: 'var(--mu)', fontSize: 13 }}>No activity recorded yet.</p>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: 44 }}>
                    <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: 'var(--bd)' }} />
                    {timeline.map((ev, i) => (
                      <div key={i} style={{ position: 'relative', marginBottom: 20 }}>
                        <div style={{ position: 'absolute', left: -44, top: 0, width: 30, height: 30, borderRadius: '50%', background: 'var(--bg3)', border: '2px solid var(--bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                          {ev.icon}
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, marginBottom: 2 }}>{ev.desc}</p>
                        <p style={{ fontSize: 11, color: 'var(--mu2)' }}>
                          {formatDistanceToNow(new Date(ev.ts), { addSuffix: true })} · {format(new Date(ev.ts), 'MMM d, yyyy')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── NOTES ── */}
            {activeTab === 'notes' && (
              <div>
                <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
                  <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', marginBottom: 14 }}>Add Note</h2>
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                    placeholder={`e.g. "Prefers email communication. Decision maker is Sarah." or "Offered 10% discount for Q3 renewal."`}
                    style={{ ...iStyle, height: 100, resize: 'none', lineHeight: 1.7, display: 'block', marginBottom: 12 }} />
                  <button onClick={saveNote} disabled={savingNote || !noteText.trim()} className="btn-primary" style={{ padding: '9px 20px' }}>
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </button>
                </div>

                {noteCards.length === 0 ? (
                  <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>
                    <p style={{ fontSize: 28, marginBottom: 10 }}>📝</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>No notes yet</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>Add notes to remember important details about this client.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {noteCards.map((note, i) => (
                      <div key={i} className="glass-card" style={{ padding: 18, position: 'relative' }}>
                        <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap', paddingRight: 36 }}>{note}</p>
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this note?')) deleteNote(i)
                          }}
                          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu2)', fontSize: 14, lineHeight: 1, padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
                          title="Delete note"
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--mu2)' }}>
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── DOCUMENTS ── */}
            {activeTab === 'documents' && (
              <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                <span style={{ fontSize: 40, display: 'block', marginBottom: 14 }}>📁</span>
                <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 8 }}>Client Documents</h3>
                <p style={{ color: 'var(--mu)', fontSize: 13, lineHeight: 1.7, maxWidth: 340, margin: '0 auto 20px' }}>
                  Attach contracts, W9 forms, quotes, agreements, and receipts to this client profile. Coming soon.
                </p>
                <Link href="/vault">
                  <button className="btn-ghost">Go to Document Vault →</button>
                </Link>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── Edit Drawer ── */}
      {client && (
        <EditDrawer
          open={editOpen}
          onClose={() => setEditOpen(false)}
          client={client}
          onSaved={updated => { setClient(updated); setEditOpen(false) }}
        />
      )}
    </div>
  )
}
