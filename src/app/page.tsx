import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-2xl">
        <div className="inline-flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <span className="text-white font-bold text-2xl tracking-tight">FINNMGR</span>
        </div>

        <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
          Your finances,<br />
          <span className="text-indigo-400">finally organized.</span>
        </h1>

        <p className="text-slate-400 text-lg mb-10 leading-relaxed">
          Track income and expenses, manage documents, and create invoices — all in one clean dashboard.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold rounded-xl transition-colors"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6 text-left">
          {[
            { icon: "📊", title: "Income & Expenses", desc: "Log transactions and see where your money goes." },
            { icon: "📄", title: "Document Storage", desc: "Upload and organize receipts, contracts, and more." },
            { icon: "🧾", title: "Invoices", desc: "Create and send professional invoices in seconds." },
          ].map((f) => (
            <div key={f.title} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="text-white font-semibold mb-1">{f.title}</div>
              <div className="text-slate-400 text-sm">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
