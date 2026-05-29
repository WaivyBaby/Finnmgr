import { createClient } from '@/lib/supabase/server'
import InvoiceManager from './InvoiceManager'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="text-slate-500 mt-1">Create and manage your invoices.</p>
      </div>
      <InvoiceManager invoices={invoices ?? []} userId={user!.id} userEmail={user!.email ?? ''} />
    </div>
  )
}
