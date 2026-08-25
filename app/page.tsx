import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowRight, Bus, QrCode, ShieldCheck } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") redirect("/admin");
  if (user?.role === "DRIVER") redirect("/driver");
  if (user?.role === "STUDENT") redirect("/student");

  return (
    <div className="public-shell">
      <header>
        <Link href="/" className="public-brand">
          <span>
            <Bus aria-hidden />
          </span>
          <strong>TAR UMT Shuttle</strong>
        </Link>
        <nav aria-label="Account">
          <Link href="/login" className="btn-ghost">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary">
            Register
          </Link>
        </nav>
      </header>
      <main id="main-content">
        <section className="public-intro">
          <div className="public-copy">
            <p className="eyebrow">Campus shuttle prototype</p>
            <h1>A clearer journey across campus.</h1>
            <p>
              Plan a From → To journey, reserve a segment-aware seat, present a
              secure boarding pass, and follow explicitly simulated shuttle
              telemetry.
            </p>
            <div>
              <Link href="/register" className="btn-primary">
                Create student account{" "}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link href="/login" className="btn-secondary">
                Sign in to your portal
              </Link>
            </div>
          </div>
          <aside className="public-route" aria-label="Product journey">
            <span>Boarding stop</span>
            <i />
            <br />
            <strong>Reserved journey</strong>
            <i />
            <br />
            <span>Destination</span>
            <small>
              One transport product. Purpose-built for students, drivers and
              operators.
            </small>
          </aside>
        </section>
        <br />
        <section
          className="public-capabilities rounded-2xl md:rounded-none"
          aria-label="System capabilities"
        >
          <article className="rounded-t-2xl md:rounded-none">
            <QrCode aria-hidden className="ml-4 md:ml-auto" />
            <div>
              <h2>Authoritative boarding</h2>
              <p>
                Short-lived signed passes are verified against durable
                reservation or Walk-in records.
              </p>
            </div>
          </article>
          <article>
            <Activity aria-hidden className="ml-4 md:ml-auto" />
            <div>
              <h2>Journey-aware capacity</h2>
              <p>
                Reserved seats follow overlapping journey segments; standing
                capacity is claimed at admission.
              </p>
            </div>
          </article>
          <article className="rounded-b-2xl md:rounded-none">
            <ShieldCheck aria-hidden className="ml-4 md:ml-auto" />
            <div>
              <h2>Operational accountability</h2>
              <p>
                Waitlist, no-show evidence, passenger credit and appeal review
                remain connected.
              </p>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
