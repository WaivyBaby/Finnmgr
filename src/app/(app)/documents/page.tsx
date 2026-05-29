import { createClient } from '@/lib/supabase/server'
import DocumentManager from './DocumentManager'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
        <p className="text-slate-500 mt-1">Upload and manage your financial documents.</p>
      </div>
      <DocumentManager documents={documents ?? []} userId={user!.id} />
    </div>
  )
}
