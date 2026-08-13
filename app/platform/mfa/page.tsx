import Link from "next/link";
import { requirePlatformOwner } from "@/middleware/rbac";
import { PlatformMfaClient } from "@/components/PlatformMfaClient";

export const dynamic = "force-dynamic";

export default async function PlatformMfaPage() {
  await requirePlatformOwner();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-14">
      <section className="tf-card">
        <p className="tf-section-kicker">Platform Owner security</p>
        <h1 className="mt-2 text-3xl font-extrabold text-ink-800">Authenticator required</h1>
        <p className="mt-4 text-[15px] leading-7 text-ink-600">
          Platform Owner controls require a TOTP-enrolled, MFA-verified session.
        </p>
        <PlatformMfaClient />
        <Link href="/platform" className="tf-primary-action mt-6 inline-flex px-4 py-3 text-[14px]">
          Recheck session
        </Link>
      </section>
    </main>
  );
}
