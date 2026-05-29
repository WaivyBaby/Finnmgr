import { createClient } from '@/lib/supabase/server'
import { TrendingUp, TrendingDown, FileText, Receipt } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: transactions }, { data: documents }, { data: invoices }] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', user!.id).order('date', { ascending: false }).limit(5),
    supabase.from('documents').select('id').eq('user_id', user!.id),
    supabase.from('invoices').select('*').eq('user_id', user!.id),
  ])

  const income = (transactions ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = (transactions ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'

  const stats = [
    { label: 'Total Income', value: `$${income.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Total Expenses', value: `$${expenses.toFixed(2)}`, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Documents', value: String(documents?.length ?? 0), icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { label: 'Invoices', value: String(invoices?.length ?? 0), icon: Receipt, color: 'text-violet-500', bg: 'bg-violet-50' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Hey, {name} 👋</h1>
        <p className="text-slate-500 mt-1">Here&apos;s your financial overview.</p>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon size={20} className={s.color} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-slate-500 text-sm mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Transactions</h2>
        </div>
        {(transactions ?? []).length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No transactions yet</p>
            <p className="text-sm">Add your first income or expense to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(transactions ?? []).map((t) => (
              <div key={t.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{t.description}</p>
                  <p className="text-sm text-slate-400">{t.category} · {new Date(t.date).toLocaleDateString()}</p>
                </div>
                <span className={`font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '-'}${Number(t.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
