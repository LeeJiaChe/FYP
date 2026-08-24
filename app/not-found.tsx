import Link from "next/link";

export default function NotFound() {
  return (
    <main className="portal-loading">
      <div className="glass-card max-w-md space-y-4 rounded-2xl p-6 text-center">
        <h1 className="section-title">Page not found</h1>
        <p className="section-subtitle">The requested shuttle page does not exist.</p>
        <Link className="btn-primary inline-flex" href="/">Return home</Link>
      </div>
    </main>
  );
}
