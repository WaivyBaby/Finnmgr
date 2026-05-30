'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

type Doc = { id: string; name: string; category: string; file_path: string; size_bytes?: number; mime_type?: string; created_at: string }

function fmtBytes(b?: number) {
  if (!b) return '—'
  if (b >= 1048576) return (b/1048576).toFixed(1)+' MB'
  if (b >= 1024) return Math.round(b/1024)+' KB'
  return b+' B'
}

const CATS = ['Invoices','Tax Docs','Bank Statements','Contracts','Reports','Receipts','Other']
const CAT_ICONS: Record<string,string> = { Invoices:'🧾','Tax Docs':'📋','Bank Statements':'🏦',Contracts:'📝',Reports:'📊',Receipts:'🗒️',Other:'📁' }

export default function VaultPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [userId, setUserId] = useState('')
  const [filter, setFilter] = useState('All')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await sb.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setDocs(data ?? [])
    setLoading(false)
  }

  async function upload(file: File) {
    setUploading(true)
    const sb = createClient()
    const path = `${userId}/${Date.now()}_${file.name}`
    const { error: upErr } = await sb.storage.from('documents').upload(path, file)
    if (upErr) { toast.error('Upload failed: ' + upErr.message); setUploading(false); return }
    const cat = guessCategory(file.name)
    await sb.from('documents').insert({ user_id: userId, name: file.name, original_name: file.name, category: cat, file_url: '', file_path: path, size_bytes: file.size, mime_type: file.type })
    toast.success(`${file.name} uploaded ✓`)
    setUploading(false)
    load()
  }

  function guessCategory(name: string) {
    const n = name.toLowerCase()
    if (n.includes('inv')) return 'Invoices'
    if (n.includes('tax') || n.includes('1099')) return 'Tax Docs'
    if (n.includes('bank') || n.includes('statement')) return 'Bank Statements'
    if (n.includes('contract') || n.includes('agreement')) return 'Contracts'
    if (n.includes('receipt')) return 'Receipts'
    if (n.includes('report')) return 'Reports'
    return 'Other'
  }

  async function download(doc: Doc) {
    const sb = createClient()
    const { data } = await sb.storage.from('documents').createSignedUrl(doc.file_path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else toast.error('Could not generate download link')
  }

  async function remove(doc: Doc) {
    const sb = createClient()
    await sb.storage.from('documents').remove([doc.file_path])
    await sb.from('documents').delete().eq('id', doc.id)
    toast.success('Deleted')
    setDocs(docs.filter(d => d.id !== doc.id))
  }

  const filtered = filter === 'All' ? docs : docs.filter(d => d.category === filter)

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 className="page-title">Document Vault</h1>
            <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Your vault is empty — but not for long.</p>
          </div>
        </div>

        <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = '' }} />

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]) }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#6366f1' : 'var(--bd2)'}`,
            borderRadius: 16, padding: '40px 24px', textAlign: 'center',
            cursor: 'pointer', marginBottom: 24, background: dragOver ? 'rgba(99,102,241,0.05)' : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
          {uploading ? (
            <p style={{ color: '#6366f1', fontWeight: 600 }}>Uploading...</p>
          ) : (
            <>
              <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>Drop files here or click to upload</p>
              <p style={{ color: 'var(--mu)', fontSize: 12, marginTop: 4 }}>PDF, images, spreadsheets — any format, up to 25MB</p>
            </>
          )}
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['All', ...CATS].map(c => (
            <button key={c} onClick={() => setFilter(c)}
              style={{
                padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                background: filter === c ? '#6366f1' : 'var(--bg3)',
                color: filter === c ? '#fff' : 'var(--mu)',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>
              {c}
            </button>
          ))}
        </div>

        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)', fontSize: 15, fontWeight: 800 }}>Files <span style={{ color: 'var(--mu)', fontWeight: 400 }}>({filtered.length})</span></h2>
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />)}</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📁</span>
              <h3>Your vault is empty — but not for long</h3>
              <p>Keep all your invoices, bank statements, contracts, and receipts in one secure place.</p>
              <button className="btn-primary" onClick={() => inputRef.current?.click()}>Upload document →</button>
            </div>
          ) : (
            <div>
              {filtered.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--bd)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {CAT_ICONS[doc.category] ?? '📄'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{doc.category} · {fmtBytes(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => download(doc)} className="btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>Download</button>
                    <button onClick={() => remove(doc)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, padding: '6px 10px', borderRadius: 8 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
