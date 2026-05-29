'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Receipt, CheckCircle, Clock, AlertCircle } from 'lucide-react'

type InvoiceItem = { description: string; qty: number; rate: number }

type Invoice = {
  id: string
  invoice_number: string
  client_name: string
  client_email: string
  items: InvoiceItem[]
  status: 'draft' | 'sent' | 'paid'
  due_date: string
  created_at: string
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', icon: Clock, color: 'text-slate-500', bg: 'bg-slate-100' },
  sent: { label: 'Sent', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
  paid: { label: 'Paid', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
}

function totalAmount(items: InvoiceItem[]) {
  return items.reduce((s, i) => s + i.qty * i.rate, 0)
}

export default function InvoiceManager({
  invoices,
  userId,
  userEmail,
}: {
  invoices: Invoice[]
  userId: string
  userEmail: string
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    due_date: '',
    items: [{ description: '', qty: 1, rate: 0 }] as InvoiceItem[],
  })

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, { description: '', qty: 1, rate: 0 }] }))
  }

  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    setForm(f => {
      const items = [...f.items]
      items[i] = { ...items[i], [field]: value }
      return { ...f, items }
    })
  }

  function removeItem(i: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const num = `INV-${Date.now().toString().slice(-6)}`
    await supabase.from('invoices').insert({
      user_id: userId,
      invoice_number: num,
      client_name: form.client_name,
      client_email: form.client_email,
      items: form.items,
      status: 'draft',
      due_date: form.due_date,
    })
    setForm({ client_name: '', client_email: '', due_date: '', items: [{ description: '', qty: 1, rate: 0 }] })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function updateStatus(id: string, status: Invoice['status']) {
    const supabase = createClient()
    await supabase.from('invoices').update({ status }).eq('id', id)
    router.refresh()
  }

  async function deleteInvoice(id: string) {
    const supabase = createClient()
    await supabase.from('invoices').delete().eq('id', id)
    router.refresh()
  }

  const subtotal = form.items.reduce((s, i) => s + i.qty * i.rate, 0)

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">All Invoices</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={16} />
            New invoice
          </button>
        </div>

        {showForm && (
          <form onSubmit={createInvoice} className="px-6 py-6 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-900 mb-4">New Invoice</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                <input
                  required
                  value={form.client_name}
                  onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                  placeholder="Acme Corp"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client Email</label>
                <input
                  type="email"
                  value={form.client_email}
                  onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Line Items</label>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      required
                      value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)}
                      placeholder="Description"
                      className="col-span-6 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="number"
                      min="1"
                      required
                      value={item.qty}
                      onChange={e => updateItem(i, 'qty', parseInt(e.target.value))}
                      placeholder="Qty"
                      className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={item.rate}
                      onChange={e => updateItem(i, 'rate', parseFloat(e.target.value))}
                      placeholder="Rate"
                      className="col-span-3 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="col-span-1 p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem} className="mt-2 text-sm text-indigo-600 hover:underline">
                + Add line item
              </button>
            </div>

            <div className="text-right text-sm font-semibold text-slate-900 mb-4">
              Total: ${subtotal.toFixed(2)}
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                {loading ? 'Creating...' : 'Create Invoice'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 text-sm font-medium rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        )}

        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            <Receipt size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No invoices yet</p>
            <p className="text-sm">Create your first invoice above.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => {
              const cfg = STATUS_CONFIG[inv.status]
              return (
                <div key={inv.id} className="px-6 py-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                      <Receipt size={16} className="text-violet-500" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{inv.invoice_number}</p>
                      <p className="text-xs text-slate-400">{inv.client_name} · Due {new Date(inv.due_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-900">${totalAmount(inv.items).toFixed(2)}</span>
                    <select
                      value={inv.status}
                      onChange={e => updateStatus(inv.id, e.target.value as Invoice['status'])}
                      className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${cfg.bg} ${cfg.color}`}
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                    </select>
                    <button
                      onClick={() => deleteInvoice(inv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={15} className="text-red-400" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
