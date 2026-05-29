import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const name = user.user_metadata?.full_name ?? ''

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <Sidebar userEmail={user.email ?? ''} userName={name} />
      <main style={{ flex: 1, overflowY: 'auto', paddingTop: 28 }}>
        {children}
      </main>
    </div>
  )
}
