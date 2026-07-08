import Link from "next/link";
import { ResendLinkForm } from "./ResendLinkForm";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; resent?: string }>;
}) {
  const { email, error, resent } = await searchParams;
  const recipient = email && email.length > 0 ? email : "your inbox";
  const rateLimited = error === "rate_limited";
  const wasResent = resent === "1" && !rateLimited;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <section className="rounded-2xl border border-ink-300/70 bg-white/85 p-6 shadow-sm">
      <div className="space-y-3">
        <p className="text-[12px] uppercase tracking-[0.18em] text-ink-500">
          Link sent
        </p>
        <h1 className="text-[32px] leading-tight tracking-tight">Check your email.</h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-ink-700">
          We sent a sign-in link to <span className="font-medium">{recipient}</span>. Open it on
          this device to finish signing in.
        </p>
      </div>

      {wasResent ? (
        <p className="mt-6 rounded-lg border border-signal-green/30 bg-signal-green/10 px-4 py-3 text-[14px] text-signal-green">
          A fresh link is on its way. Only the newest link will work.
        </p>
      ) : null}
      {rateLimited ? (
        <p role="alert" className="mt-6 rounded-lg border border-signal-amber/30 bg-signal-amber/10 px-4 py-3 text-[14px] text-signal-amber">
          You&apos;ve requested several links in a short time, so we&apos;ve paused sending to
          protect your account. Wait about 10 minutes, then try again — or use a link already
          in your inbox.
        </p>
      ) : null}

      <div className="mt-10 flex flex-wrap items-center gap-4">
        {email && email.length > 0 ? <ResendLinkForm email={email} /> : null}
        <Link
          href="/auth"
          className="inline-flex w-fit items-center text-[14px] text-ink-700 underline decoration-ink-300 underline-offset-4 transition hover:decoration-ink-900"
        >
          Use a different email
        </Link>
      </div>

      </section>

      <p className="mt-10 text-[12px] text-ink-500">
        Didn&apos;t receive it after a minute? Check spam, resend the link, or ask your admin to
        confirm you&apos;re on the team.
      </p>
    </main>
  );
}
