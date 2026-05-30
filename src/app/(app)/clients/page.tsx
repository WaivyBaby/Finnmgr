'use client'
/*
  SQL — run once in Supabase SQL Editor if these columns don't exist:
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_terms text DEFAULT 'Net 30';
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS website text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes text;
*/
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import CountUp from 'react-countup'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

/* ── Types ── */
type Client = {
  id: string; user_id: string; name: string; email?: string; phone?: string
  company?: string; total_billed: number; total_paid: number; invoice_count: number
  status: string; avatar_color: string; created_at: string; updated_at?: string
  payment_terms?: string; tags?: string[]; website?: string; industry?: string; notes?: string
}
type ClientForm = {
  name: string; company: string; email: string; phone: string; address: string
  website: string; industry: string; status: string; payment_terms: string
  tags: string[]; notes: string
}

/* ── Constants ── */
const COLORS = ['#6366f1','#10b981','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#ff7043']
const STATUS_MAP: Record<string, string> = {
  lead: 'status-draft', client: 'status-paid', vip: 'status-viewed',
  recurring: 'status-sent', inactive: 'status-cancelled', 'at-risk': 'status-overdue',
}
const STATUS_LABELS = ['lead','client','vip','recurring','inactive','at-risk']
const INDUSTRIES = ['Technology','Marketing','Design','Consulting','Healthcare','Finance','Legal','Real Estate','Education','E-commerce','Other']
const PAYMENT_TERMS = ['Due Upon Receipt','Net 7','Net 15','Net 30','Net 60','Custom']
const DEFAULT_FORM: ClientForm = { name:'', company:'', email:'', phone:'', address:'', website:'', industry:'', status:'client', payment_terms:'Net 30', tags:[], notes:'' }

const STAT_TOOLTIPS: Record<string, string> = {
  total: 'The total number of clients in your account.',
  active: 'Clients with an active, VIP, or recurring status.',
  inactive: 'Clients marked as inactive or leads not yet converted.',
  revenue: 'Total amount billed to all clients combined.',
  outstanding: 'Money your clients still owe your business.',
  avg: 'Average revenue generated per client.',
  new: 'Clients added since the 1st of this month.',
  repeat: 'Clients with more than one invoice on record.',
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/* ── Chart tooltip ── */
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 14px', fontSize: 11 }}>
      <p style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#6366f1' }}>New clients: {payload[0].value}</p>
    </div>
  )
}

/* ── Build growth chart data ── */
function buildGrowthData(clients: Client[], view: 'monthly' | 'quarterly' | 'yearly') {
  if (clients.length === 0) return []
  const counts: Record<string, number> = {}
  clients.forEach(c => {
    const d = new Date(c.created_at)
    let key: string
    if (view === 'monthly') key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    else if (view === 'quarterly') key = `Q${Math.ceil((d.getMonth() + 1) / 3)} '${d.getFullYear().toString().slice(-2)}`
    else key = d.getFullYear().toString()
    counts[key] = (counts[key] ?? 0) + 1
  })
  return Object.entries(counts).map(([label, count]) => ({ label, count }))
}

/* ── Add/Edit Client Drawer ── */
function ClientDrawer({
  open, onClose, onSaved, colorIndex, initial,
}: {
  open: boolean; onClose: () => void; onSaved: (c: Client) => void
  colorIndex: number; initial?: Client
}) {
  const [form, setForm] = useState<ClientForm>(initial ? {
    name: initial.name, company: initial.company ?? '', email: initial.email ?? '',
    phone: initial.phone ?? '', address: '', website: initial.website ?? '',
    industry: initial.industry ?? '', status: initial.status, payment_terms: initial.payment_terms ?? 'Net 30',
    tags: initial.tags ?? [], notes: initial.notes ?? '',
  } : { ...DEFAULT_FORM })
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name, company: initial.company ?? '', email: initial.email ?? '',
        phone: initial.phone ?? '', address: '', website: initial.website ?? '',
        industry: initial.industry ?? '', status: initial.status, payment_terms: initial.payment_terms ?? 'Net 30',
        tags: initial.tags ?? [], notes: initial.notes ?? '',
      } : { ...DEFAULT_FORM })
      setTagInput('')
    }
  }, [open, initial])

  function addTag() {
    const val = tagInput.trim().replace(/,/g, '')
    if (val && !form.tags.includes(val)) setForm(f => ({ ...f, tags: [...f.tags, val] }))
    setTagInput('')
  }

  function removeTag(t: string) { setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = { ...form }
    if (isEdit && initial) {
      const { data, error } = await sb.from('clients').update(payload).eq('id', initial.id).select().single()
      setSaving(false)
      if (error) { toast.error('Failed to save'); return }
      toast.success('Client updated ✓'); onSaved(data as Client); onClose()
    } else {
      const { data, error } = await sb.from('clients').insert({
        user_id: user.id, ...payload,
        avatar_color: COLORS[colorIndex % COLORS.length],
        total_billed: 0, total_paid: 0, invoice_count: 0,
      }).select().single()
      setSaving(false)
      if (error) { toast.error('Failed to add client'); return }
      toast.success('Client added ✓'); onSaved(data as Client); onClose()
    }
  }

  const iStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'var(--in-bg)', border: '1.5px solid var(--in-bd)', borderRadius: 10, fontSize: 13, color: 'var(--in-txt)', outline: 'none', fontFamily: 'inherit', marginTop: 6 }
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mu)', display: 'block' }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 799 }} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
              <div>
                <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{isEdit ? 'Edit Client' : 'Add Client'}</h3>
                <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>
                  {isEdit ? 'Update client details below.' : 'Fill in the details. Avatar color is auto-assigned.'}
                </p>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mu)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {/* Scrollable body */}
            <form onSubmit={submit} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input style={iStyle} required placeholder="Jane Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Company</label>
                  <input style={iStyle} placeholder="Acme Corp" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Industry</label>
                  <select style={iStyle} value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input style={iStyle} type="email" required placeholder="jane@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={iStyle} placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Website</label>
                  <input style={iStyle} placeholder="https://example.com" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Status
                    <span title="Lead = prospect, Client = active, VIP = high-value, Recurring = subscription" style={{ cursor: 'help', fontSize: 12 }}>ℹ️</span>
                  </label>
                  <select style={iStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_LABELS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Payment Terms
                    <span title="When invoices are due relative to the issue date" style={{ cursor: 'help', fontSize: 12 }}>ℹ️</span>
                  </label>
                  <select style={iStyle} value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                    {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Tags</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input style={{ ...iStyle, marginTop: 0, flex: 1 }} placeholder="Add tag, press Enter" value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }} />
                    <button type="button" onClick={addTag} className="btn-ghost" style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>Add</button>
                  </div>
                  {form.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {form.tags.map(t => (
                        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontSize: 11, fontWeight: 600 }}>
                          {t}
                          <button type="button" onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea style={{ ...iStyle, height: 80, resize: 'none', lineHeight: 1.6 }} placeholder="e.g. Prefers email. Decision maker is Sarah." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </form>

            {/* Sticky footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 10 }}>
              <button onClick={submit as unknown as React.MouseEventHandler} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Client'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '12px 20px' }}>Cancel</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ── Empty State ── */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state" style={{ padding: '80px 24px' }}>
      <span className="empty-icon">👥</span>
      <h3>No clients yet — your first is the most important</h3>
      <p>Add clients to streamline your business:</p>
      <ul style={{ textAlign: 'left', display: 'inline-block', margin: '8px 0 20px', fontSize: 13, color: 'var(--mu)', lineHeight: 2 }}>
        <li>✓ Create invoices faster with saved client details</li>
        <li>✓ Track revenue and outstanding balances per client</li>
        <li>✓ Monitor payment history and activity</li>
        <li>✓ Keep all client records organized in one place</li>
      </ul>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn-primary" onClick={onAdd}>Add First Client →</button>
        <button className="btn-ghost" onClick={() => toast('Add your first client to unlock insights! 💡')}>Learn More</button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════ */
export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortKey, setSortKey] = useState<'name'|'revenue'|'balance'|'created_at'>('created_at')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [chartView, setChartView] = useState<'monthly'|'quarterly'|'yearly'>('monthly')
  const [hoveredStat, setHoveredStat] = useState<string|null>(null)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await sb.from('clients').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setClients(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* Computed stats */
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalRevenue = clients.reduce((s, c) => s + Number(c.total_billed), 0)
  const outstanding = clients.reduce((s, c) => s + Math.max(0, Number(c.total_billed) - Number(c.total_paid)), 0)
  const activeClients = clients.filter(c => ['client','vip','recurring'].includes(c.status)).length
  const inactiveClients = clients.filter(c => ['inactive','lead'].includes(c.status)).length
  const avgValue = clients.length > 0 ? totalRevenue / clients.length : 0
  const newThisMonth = clients.filter(c => new Date(c.created_at) >= monthStart).length
  const repeatClients = clients.filter(c => Number(c.invoice_count) > 1).length

  /* Top 5 */
  const top5 = [...clients].sort((a, b) => Number(b.total_billed) - Number(a.total_billed)).slice(0, 5)
  const maxBilled = top5[0]?.total_billed ?? 1

  /* Smart insights */
  const insights = useMemo(() => {
    const list: { icon: string; msg: string; action: string; color: string; onAction: () => void }[] = []
    if (clients.length === 0) return list
    const totalRev = clients.reduce((s, c) => s + Number(c.total_billed), 0)
    const topClient = [...clients].sort((a, b) => Number(b.total_billed) - Number(a.total_billed))[0]
    if (topClient && totalRev > 0) {
      const pct = Math.round((Number(topClient.total_billed) / totalRev) * 100)
      list.push({ icon: '🏆', msg: `${topClient.name} generated ${pct}% of your total revenue`, action: 'View client', color: '#10b981', onAction: () => router.push(`/clients/${topClient.id}`) })
    }
    const withBalance = clients.filter(c => Number(c.total_billed) - Number(c.total_paid) > 0)
    if (withBalance.length > 0) {
      const worst = withBalance.sort((a, b) => (Number(b.total_billed) - Number(b.total_paid)) - (Number(a.total_billed) - Number(a.total_paid)))[0]
      const bal = Number(worst.total_billed) - Number(worst.total_paid)
      list.push({ icon: '⚠️', msg: `${worst.name} has an outstanding balance of $${bal.toFixed(2)}`, action: 'Send reminder', color: '#f59e0b', onAction: () => toast.success(`Reminder queued for ${worst.name} 📨`) })
    }
    if (newThisMonth > 0) {
      list.push({ icon: '🎉', msg: `${newThisMonth} new client${newThisMonth > 1 ? 's' : ''} added this month`, action: 'View all', color: '#6366f1', onAction: () => setFilterStatus('all') })
    }
    if (activeClients === 0 && clients.length > 0) {
      list.push({ icon: '💡', msg: 'No active clients yet — update client statuses to track revenue', action: 'Learn more', color: '#0ea5e9', onAction: () => toast('Set client status to Client, VIP, or Recurring to track them as active.') })
    }
    return list.slice(0, 4)
  }, [clients, newThisMonth, activeClients, router])

  /* Filter + sort */
  const filtered = useMemo(() => {
    let list = [...clients]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => [c.name, c.company, c.email, c.phone, c.notes].some(f => f?.toLowerCase().includes(q)))
    }
    if (filterStatus === 'has-balance') list = list.filter(c => Number(c.total_billed) - Number(c.total_paid) > 0)
    else if (filterStatus !== 'all') list = list.filter(c => c.status === filterStatus)
    list.sort((a, b) => {
      let av: number | string, bv: number | string
      if (sortKey === 'revenue') { av = Number(a.total_billed); bv = Number(b.total_billed) }
      else if (sortKey === 'balance') { av = Number(a.total_billed) - Number(a.total_paid); bv = Number(b.total_billed) - Number(b.total_paid) }
      else if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase() }
      else { av = a.created_at; bv = b.created_at }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
    return list
  }, [clients, search, filterStatus, sortKey, sortDir])

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function sortIndicator(key: typeof sortKey) {
    if (sortKey !== key) return ' ↕'
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  function exportClients() {
    const blob = new Blob([JSON.stringify(clients, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'clients.json'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Clients exported ✓')
  }

  const chartData = buildGrowthData(clients, chartView)

  const STAT_CARDS = [
    { key: 'total', label: 'Total Clients', value: clients.length, prefix: '', decimals: 0, color: '#6366f1', icon: '👥' },
    { key: 'active', label: 'Active Clients', value: activeClients, prefix: '', decimals: 0, color: '#10b981', icon: '✅' },
    { key: 'inactive', label: 'Inactive / Leads', value: inactiveClients, prefix: '', decimals: 0, color: '#f59e0b', icon: '💤' },
    { key: 'revenue', label: 'Total Revenue', value: totalRevenue, prefix: '$', decimals: 2, color: '#10b981', icon: '💰' },
    { key: 'outstanding', label: 'Outstanding Balance', value: outstanding, prefix: '$', decimals: 2, color: outstanding > 0 ? '#f59e0b' : '#10b981', icon: '⏳' },
    { key: 'avg', label: 'Avg Client Value', value: avgValue, prefix: '$', decimals: 2, color: '#0ea5e9', icon: '📊' },
    { key: 'new', label: 'New This Month', value: newThisMonth, prefix: '', decimals: 0, color: '#8b5cf6', icon: '🆕' },
    { key: 'repeat', label: 'Repeat Clients', value: repeatClients, prefix: '', decimals: 0, color: '#ec4899', icon: '🔄' },
  ]

  const FILTER_PILLS = [
    { key: 'all', label: 'All' },
    { key: 'client', label: 'Active' },
    { key: 'vip', label: 'VIP' },
    { key: 'recurring', label: 'Recurring' },
    { key: 'lead', label: 'Lead' },
    { key: 'inactive', label: 'Inactive' },
    { key: 'at-risk', label: 'At Risk' },
    { key: 'has-balance', label: 'Has Balance' },
  ]

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ height: 44, width: 280, marginBottom: 28 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {[...Array(8)].map((_, i) => <div key={i} style={{ height: 90 }} className="skeleton" />)}
        </div>
        <div style={{ height: 300 }} className="skeleton" />
      </div>
    )
  }

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Clients</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Your most valuable relationships.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => setDrawerOpen(true)}>+ Add Client</button>
            <button className="btn-ghost" onClick={() => router.push('/invoices')}>Create Invoice</button>
            <button className="btn-ghost" onClick={() => toast('Estimate builder coming soon 🚀')}>Create Estimate</button>
            <button className="btn-ghost" onClick={exportClients}>Export Clients</button>
            <button className="btn-ghost" onClick={() => toast('Import coming soon 🚀')}>Import Clients</button>
          </div>
        </div>

        {clients.length === 0 ? (
          <EmptyState onAdd={() => setDrawerOpen(true)} />
        ) : (
          <>
            {/* ── 8 Stat Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
              {STAT_CARDS.map((s, i) => (
                <motion.div key={s.key} className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredStat(s.key)}
                  onMouseLeave={() => setHoveredStat(null)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <span style={{ fontSize: 13, cursor: 'help', opacity: 0.5 }}>ℹ️</span>
                  </div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>
                    {s.prefix}<CountUp end={s.value} decimals={s.decimals} duration={1.2} separator="," />
                  </div>
                  {hoveredStat === s.key && (
                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, width: 200, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '10px 12px', fontSize: 11, color: 'var(--ink)', lineHeight: 1.6, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
                      {STAT_TOOLTIPS[s.key]}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* ── Growth Chart + Top Clients ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginBottom: 20 }}>
              <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Client Growth</h2>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['monthly','quarterly','yearly'] as const).map(v => (
                      <button key={v} onClick={() => setChartView(v)} style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, background: chartView === v ? '#6366f1' : 'var(--bg3)', color: chartView === v ? '#fff' : 'var(--mu)', transition: 'all 0.15s' }}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                {chartData.length === 0 ? (
                  <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--mu)' }}>
                    <span style={{ fontSize: 32, marginBottom: 10 }}>📈</span>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>Add more clients to see growth trends</p>
                    <p style={{ fontSize: 11, marginTop: 4 }}>Chart appears when you have clients over multiple periods</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--mu)' }} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} />
                      <Line type="monotone" dataKey="count" name="New Clients" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} animationDuration={700} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </motion.div>

              <motion.div className="glass-card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}>Top Clients</h2>
                {top5.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--mu)', textAlign: 'center', padding: '40px 0' }}>No revenue data yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {top5.map(c => {
                      const bal = Number(c.total_billed) - Number(c.total_paid)
                      const barW = maxBilled > 0 ? (Number(c.total_billed) / Number(maxBilled)) * 100 : 0
                      return (
                        <button key={c.id} onClick={() => router.push(`/clients/${c.id}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '6px 8px', borderRadius: 10, transition: 'background 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg3)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: c.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{initials(c.name)}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{c.name}</p>
                            <div className="progress-track" style={{ height: 5 }}>
                              <div className="progress-fill" style={{ width: `${barW}%`, background: c.avatar_color, transition: 'width 0.8s ease' }} />
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink)', fontFamily: `DM Mono, monospace` }}>${Number(c.total_billed).toFixed(0)}</p>
                            {bal > 0 && <p style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>+${bal.toFixed(0)} owed</p>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── Smart Insights ── */}
            {insights.length > 0 && (
              <motion.div className="glass-card" style={{ padding: 20, marginBottom: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Smart Insights</h2>
                  <div className="live-dot" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  {insights.map((ins, i) => (
                    <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg3)', border: `1px solid ${ins.color}22` }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{ins.icon}</span>
                        <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{ins.msg}</p>
                      </div>
                      <button onClick={ins.onAction} style={{ fontSize: 11, fontWeight: 800, color: ins.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {ins.action} →
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Table ── */}
            <motion.div className="glass-card" style={{ padding: 0, overflow: 'hidden' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              {/* Controls */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input className="input" style={{ maxWidth: 240, height: 36 }} placeholder="🔍 Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                  {FILTER_PILLS.map(f => (
                    <button key={f.key} onClick={() => setFilterStatus(f.key)}
                      style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: filterStatus === f.key ? '#6366f1' : 'var(--bg3)', color: filterStatus === f.key ? '#fff' : 'var(--mu)' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap' }}>{filtered.length} clients</span>
              </div>

              {/* Table */}
              {filtered.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--mu)' }}>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>No clients match your search</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-base" style={{ minWidth: 800 }}>
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: 20 }}>
                          <button onClick={() => toggleSort('name')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)' }}>
                            Client{sortIndicator('name')}
                          </button>
                        </th>
                        <th>Company</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>
                          <button onClick={() => toggleSort('revenue')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)' }}>
                            Revenue{sortIndicator('revenue')}
                          </button>
                        </th>
                        <th>
                          <button onClick={() => toggleSort('balance')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)' }}>
                            Outstanding{sortIndicator('balance')}
                          </button>
                        </th>
                        <th>
                          <button onClick={() => toggleSort('created_at')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--mu2)' }}>
                            Client Since{sortIndicator('created_at')}
                          </button>
                        </th>
                        <th style={{ paddingRight: 20, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(c => {
                        const bal = Math.max(0, Number(c.total_billed) - Number(c.total_paid))
                        return (
                          <tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)} style={{ cursor: 'pointer' }}>
                            <td style={{ paddingLeft: 20 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 9, background: c.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>{initials(c.name)}</span>
                                </div>
                                <div>
                                  <p style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</p>
                                  {(c.tags ?? []).length > 0 && (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                                      {(c.tags ?? []).slice(0, 2).map(t => (
                                        <span key={t} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 700 }}>{t}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ color: 'var(--mu)', fontSize: 12 }}>{c.company || '—'}</td>
                            <td style={{ color: 'var(--mu)', fontSize: 12 }}>{c.email || '—'}</td>
                            <td><span className={`status-pill ${STATUS_MAP[c.status] ?? 'status-draft'}`}>{c.status}</span></td>
                            <td style={{ fontFamily: `DM Mono, monospace`, fontSize: 12, fontWeight: 600, color: '#10b981' }}>${Number(c.total_billed).toFixed(2)}</td>
                            <td style={{ fontFamily: `DM Mono, monospace`, fontSize: 12, fontWeight: 600, color: bal > 0 ? '#f59e0b' : 'var(--mu)' }}>
                              {bal > 0 ? `$${bal.toFixed(2)}` : '—'}
                            </td>
                            <td style={{ color: 'var(--mu)', fontSize: 12 }}>{new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            <td style={{ paddingRight: 20, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => router.push(`/clients/${c.id}`)} className="btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}>View →</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </>
        )}
      </motion.div>

      {/* ── Add Client Drawer ── */}
      <ClientDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        colorIndex={clients.length}
        onSaved={c => {
          setClients(prev => [c, ...prev])
          setDrawerOpen(false)
        }}
      />
    </div>
  )
}
