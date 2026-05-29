import { createClient } from '@/lib/supabase/server'
import TransactionList from './TransactionList'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user!.id)
    .order('date', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500 mt-1">Track your income and expenses.</p>
        </div>
      </div>
      <TransactionList transactions={transactions ?? []} userId={user!.id} />
    </div>
  )
}
