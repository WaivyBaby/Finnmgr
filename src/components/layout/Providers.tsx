'use client'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import { CommandPalette } from '@/components/shared/CommandPalette'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <div className="jitter-mesh" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />
      <div className="orb orb-4" aria-hidden="true" />
      {children}
      <CommandPalette />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'var(--bg2)',
            color: 'var(--ink)',
            border: '1px solid var(--bd2)',
            borderRadius: '11px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '13px',
            fontWeight: '500',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          duration: 3200,
        }}
      />
    </ThemeProvider>
  )
}
