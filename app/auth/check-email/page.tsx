import Link from "next/link";
import { ResendLinkForm } from "./ResendLinkForm";
import { BrandLogo } from "@/components/BrandLogo";

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
    <main className="min-h-screen bg-white md:grid md:grid-cols-[1fr_minmax(520px,620px)]">
      <section className="flex h-[388px] flex-col bg-brand-charcoal px-[22px] pb-[34px] pt-7 text-white md:h-auto md:px-14 md:py-14">
        <BrandLogo variant="mark" reversed className="h-6 w-6" priority />
        <div className="mt-auto max-w-[420px]">
          <h1 className="text-[30px] font-extrabold leading-[1.18] tracking-[-0.8px] md:text-[40px] md:tracking-[-1.1px]">
            People operations, made ready.
          </h1>
          <p className="mt-4 max-w-[400px] text-[15.5px] leading-normal text-[#B0B8C2] md:text-[17px]">
            See what needs attention. Know what comes next.
          </p>
        </div>
      </section>

      <section className="-mt-[14px] rounded-t-[14px] bg-white px-[22px] pb-6 pt-7 md:mt-0 md:flex md:flex-col md:justify-center md:rounded-none md:px-16">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-green" aria-hidden="true" />
          <p className="text-[12px] font-bold text-signal-green">Link sent</p>
        </div>
        <h1 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.7px] text-ink-800">Check your email</h1>
        <p className="mt-3 max-w-prose text-[15.5px] leading-relaxed text-ink-700">
          We sent a sign-in link to <span className="font-medium">{recipient}</span>. It opens TeamFrame on this device.
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
          className="tf-secondary-action inline-flex h-12 w-fit items-center px-5 text-[15px] font-bold"
        >
          Use a different email
        </Link>
      </div>

      <p className="mt-8 text-[12px] text-ink-500">
        Didn&apos;t receive it after a minute? Check spam, resend the link, or ask your admin to
        confirm you&apos;re on the team.
      </p>
      </section>
    </main>
  );
}
