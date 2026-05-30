'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

type TaxEstimate = { id: string; quarter: number; year: number; estimated_amount: number; saved_amount: number; status: string; due_date?: string; paid_date?: string }

const Q_LABELS: Record<number,string> = { 1:'Q1 (Jan–Mar)', 2:'Q2 (Apr–Jun)', 3:'Q3 (Jul–Sep)', 4:'Q4 (Oct–Dec)' }

export default function TaxPage() {
  const [estimates, setEstimates] = useState<TaxEstimate[]>([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [deductible, setDeductible] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  const year = new Date().getFullYear()
  const TAX_RATE = 0.25

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [{ data: est }, { data: inc }, { data: exp }] = await Promise.all([
      sb.from('tax_estimates').select('*').eq('user_id', user.id).eq('year', year).order('quarter'),
      sb.from('income').select('amount').eq('user_id', user.id),
      sb.from('expenses').select('amount,is_deductible').eq('user_id', user.id),
    ])

    const inc_ = (inc ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const ded = (exp ?? []).filter(e => e.is_deductible).reduce((s, r) => s + Number(r.amount), 0)
    setTotalIncome(inc_)
    setDeductible(ded)
    setEstimates(est ?? [])
    setLoading(false)
  }

  async function updateSaved(id: string, saved: number) {
    const sb = createClient()
    await sb.from('tax_estimates').update({ saved_amount: saved }).eq('id', id)
    toast.success('Saved amount updated ✓')
    load()
  }

  async function markPaid(id: string) {
    const sb = createClient()
    await sb.from('tax_estimates').update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id)
    toast.success('Marked as paid ✓')
    load()
  }

  const taxableIncome = Math.max(0, totalIncome - deductible)
  const estimatedTax = taxableIncome * TAX_RATE
  const totalSaved = estimates.reduce((s, e) => s + Number(e.saved_amount), 0)
  const jarPct = estimatedTax > 0 ? Math.min(100, (totalSaved / estimatedTax) * 100) : 0

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 className="page-title">Tax Prep Center</h1>
          <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 4 }}>Stay ready. No April surprises.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 28 }}>
          {/* Left: estimates */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Gross Income', value: `$${totalIncome.toFixed(2)}`, color: '#10b981' },
                { label: 'Tax Deductions', value: `$${deductible.toFixed(2)}`, color: '#6366f1' },
                { label: 'Taxable Income', value: `$${taxableIncome.toFixed(2)}`, color: '#f59e0b' },
                { label: 'Est. Tax Owed (25%)', value: `$${estimatedTax.toFixed(2)}`, color: '#ef4444' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
                <h2 style={{ fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)', fontSize: 15, fontWeight: 800 }}>Quarterly Estimates {year}</h2>
              </div>
              {loading ? <div style={{ padding: 20 }}><div className="skeleton" style={{ height: 200 }} /></div> : estimates.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 20px' }}>
                  <h3>No tax estimates yet</h3>
                  <p>Tax estimates are created automatically when you sign up.</p>
                </div>
              ) : (
                <div>
                  {estimates.map(e => {
                    const qTax = (estimatedTax / 4)
                    const qSaved = Number(e.saved_amount)
                    const ready = qSaved >= qTax
                    return (
                      <div key={e.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <p style={{ fontWeight: 700, fontSize: 13 }}>{Q_LABELS[e.quarter]}</p>
                            <span className={`status-pill status-${e.status}`}>{e.status}</span>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--mu)' }}>
                            Due: {e.due_date ? new Date(e.due_date).toLocaleDateString() : '—'} · Est: ${qTax.toFixed(2)}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: ready ? '#10b981' : 'var(--ink)' }}>
                            {ready ? '✅ Ready' : `$${qSaved.toFixed(2)} saved`}
                          </p>
                          {e.status !== 'paid' && (
                            <button onClick={() => markPaid(e.id)} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2, padding: 0 }}>
                              Mark paid →
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Tax Jar */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display, Cabinet Grotesk, sans-serif)', fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Tax Jar</h3>
            <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 24 }}>How ready are you?</p>
            <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 20 }}>
              <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg3)" strokeWidth="12" />
                <motion.circle cx="60" cy="60" r="50" fill="none" stroke={jarPct >= 100 ? '#10b981' : jarPct >= 50 ? '#f59e0b' : '#6366f1'} strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - jarPct / 100) }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 26 }}>{jarPct >= 100 ? '✅' : jarPct >= 50 ? '😊' : '😅'}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{jarPct.toFixed(0)}%</span>
              </div>
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>${totalSaved.toFixed(2)} saved</p>
            <p style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 20 }}>of ${estimatedTax.toFixed(2)} needed</p>
            {jarPct < 100 && (
              <p style={{ fontSize: 12, color: '#f59e0b', padding: '8px 12px', background: 'rgba(245,158,11,0.1)', borderRadius: 8 }}>
                Set aside ${((estimatedTax - totalSaved) / 12).toFixed(0)}/mo to catch up
              </p>
            )}
            {jarPct >= 100 && (
              <p style={{ fontSize: 12, color: '#10b981', padding: '8px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: 8 }}>
                Tax ready! No April stress for you 😌
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
