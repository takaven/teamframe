import Link from "next/link";
import Image from "next/image";
import dashboardShot from "@/public/marketing/dashboard-risk-signals.png";
import { BrandLogo } from "@/components/BrandLogo";
import { TakavenEndorsement } from "@/components/TakavenEndorsement";

// Pilot-request contact address. Set NEXT_PUBLIC_PILOT_CONTACT_EMAIL in the
// environment (see .env.example). The founder owns this value; keep the
// mailto pattern. If unset, the "Request a pilot" CTA is not rendered —
// an honest omission beats a dead placeholder address.
const PILOT_CONTACT_EMAIL = process.env.NEXT_PUBLIC_PILOT_CONTACT_EMAIL;
const PILOT_MAILTO = PILOT_CONTACT_EMAIL
  ? `mailto:${PILOT_CONTACT_EMAIL}?subject=TeamFrame%20pilot%20request`
  : null;

const FEATURES = [
  {
    kicker: "Organise",
    title: "Employee records & documents",
    body: "Every employee's details, contracts, IDs and country-specific records in one private, permissioned place — with expiry tracking built in.",
  },
  {
    kicker: "Run",
    title: "Leave, onboarding & policies",
    body: "Approve leave, work through onboarding checklists, and publish policies your team acknowledges by version. The everyday HR admin, handled.",
  },
  {
    kicker: "Stay ahead",
    title: "What needs attention",
    body: "TeamFrame flags expiring documents, unacknowledged policies and pending approvals — each with a clear next action.",
  },
] as const;

export default function Home() {
  return (
    <main className="tf-public-page mx-auto min-h-screen max-w-5xl px-6 py-10 md:py-14">
      <header className="tf-public-header flex items-center justify-between pb-5">
        <BrandLogo className="h-auto w-48" priority />
        <Link href="/auth" className="text-[14px] text-ink-700 transition hover:text-ink-900">
          Sign in
        </Link>
      </header>

      <section className="tf-public-hero mt-14 max-w-3xl space-y-6">
        <p className="text-[12px] uppercase tracking-[0.14em] text-ink-500">
          HR software
        </p>
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] md:text-[48px]">
          Your team&apos;s HR, in one place.
        </h1>
        <p className="max-w-2xl text-[17px] leading-relaxed text-ink-700">
          TeamFrame is a focused HR system for growing organisations that don&apos;t
          have a dedicated HR team. Keep employee records, documents, leave,
          onboarding and policies in one place — and see what needs attention, with
          the next action for each, before it becomes a problem.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          {PILOT_MAILTO ? (
            <a
              href={PILOT_MAILTO}
              className="tf-primary-action px-6 py-3 text-[15px]"
            >
              Request a pilot
            </a>
          ) : null}
          <Link
            href="/auth"
            className={
              PILOT_MAILTO
                ? "tf-secondary-action px-6 py-3 text-[15px]"
                : "tf-primary-action px-6 py-3 text-[15px]"
            }
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Real product, real demo data — captured from the seeded overview. */}
      <section className="mt-14" aria-label="Product preview">
        <figure className="tf-public-preview overflow-hidden p-3 md:p-4">
          <Image
            src={dashboardShot}
            alt="TeamFrame overview: what needs attention across the team, with the next action for each item"
            priority
            className="w-full rounded-xl"
            sizes="(max-width: 1024px) 100vw, 976px"
          />
          <figcaption className="px-2 pb-1 pt-3 text-[12px] text-ink-500">
            The overview on demo data — what needs attention, and the next action for each.
          </figcaption>
        </figure>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            className="tf-public-feature p-5"
          >
            <p className="text-[12px] uppercase tracking-[0.12em] text-ink-500">{feature.kicker}</p>
            <h2 className="mt-2 text-[19px] leading-snug tracking-tight">{feature.title}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-500">{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-16 border-t border-ink-300/60 pt-8">
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-700">
          Built by an HR practitioner who has run people-ops across UAE,
          Mauritius and global banking.
        </p>
      </section>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-ink-300/60 pt-5 text-[12px] text-ink-500">
        <span>TeamFrame &middot; <span className="tabular-nums">{new Date().getFullYear()}</span></span>
        <TakavenEndorsement />
      </footer>
    </main>
  );
}
