export default function IsoHealthLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-slate-200" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="mt-6 h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </section>
    </main>
  );
}
