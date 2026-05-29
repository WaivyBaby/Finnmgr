import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
      <div style={{ textAlign: 'center', maxWidth: 640 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 900, fontSize: 22 }}>F</span>
          </div>
          <span style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 900, fontSize: 28, letterSpacing: '-0.04em', color: 'var(--ink)' }}>FINNMGR</span>
        </div>

        <h1 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 52, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1.05, marginBottom: 20 }}>
          The financial OS for businesses that give a damn.
        </h1>

        <p style={{ fontSize: 17, color: 'var(--mu)', lineHeight: 1.7, marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
          Invoicing, expenses, income tracking, tax prep, and cash flow — all in one place. Built for small businesses. Designed to delight.
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/auth/signup" className="btn-primary" style={{ textDecoration: 'none', fontSize: 14, padding: '12px 28px', borderRadius: 12 }}>
            Get started free →
          </Link>
          <Link href="/auth/login" className="btn-ghost" style={{ textDecoration: 'none', fontSize: 14, padding: '12px 28px', borderRadius: 12 }}>
            Sign in
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 64 }}>
          {[
            { icon: '🧾', title: 'Smart Invoicing', desc: 'Create and send invoices in seconds. Track who owes you what.' },
            { icon: '📊', title: 'Income & Expenses', desc: 'Log every transaction. Know your real margins.' },
            { icon: '🧮', title: 'Tax Ready', desc: 'Quarterly estimates, deductions, and a tax jar that keeps you prepared.' },
          ].map(f => (
            <div key={f.title} className="glass-card" style={{ padding: '20px 18px', textAlign: 'left' }}>
              <span style={{ fontSize: 28, display: 'block', marginBottom: 12 }}>{f.icon}</span>
              <p style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>{f.title}</p>
              <p style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
