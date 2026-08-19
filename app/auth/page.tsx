import Link from "next/link";
import { createServerClient } from "@/lib/db/supabaseServer";
import { resolveIdentity } from "@/lib/rbac/roles";
import { AuthForm } from "./AuthForm";
import { continueCurrentSessionAction, switchAccountAction } from "./actions";
import { BrandLogo } from "@/components/BrandLogo";

const ERROR_COPY: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email.",
  callback_failed: "Sign-in link could not be verified. Send one fresh link and use it right away.",
  not_authorized: "That email isn't on the team yet. Ask your admin to add you.",
  switched_account: "You have been signed out. Continue with the other account's link.",
};

const CALLBACK_REASON_COPY: Record<string, string> = {
  provider_rejected: "Sign-in provider rejected that link. Send a fresh link and use only the latest email.",
  missing_token: "That sign-in link is incomplete. Send a new link from the sign-in page.",
  expired_link: "That link expired. Send a fresh link and open it immediately.",
  already_used_link: "That sign-in link has already been used. Request a fresh one and use it right away.",
  invalid_link: "That sign-in link is invalid. Delete old emails and use the newest link.",
  stale_return_to: "That sign-in link pointed to an outdated page. Use a fresh link from the sign-in page.",
  invalid_tenant: "Your account is missing required team access. Ask your admin to verify your tenant setup.",
  session_mismatch: "That link belongs to a different session. Sign in again from the correct email.",
  session_recovered: "Your existing session is still active. Continue from your dashboard.",
  auth_unavailable: "Sign-in is temporarily unavailable. Wait a moment and try a fresh link.",
  session_exchange_failed: "Could not complete sign-in from that link. Request a new one and retry.",
  unknown: "Sign-in could not be completed. Request a fresh link and retry.",
};

const CALLBACK_REASON_TITLES: Record<string, string> = {
  expired_link: "Link expired",
  already_used_link: "Link already used",
  invalid_link: "Invalid link",
  session_mismatch: "Wrong active session",
};

function getErrorMessage(error: string | undefined, reason: string | undefined): string | null {
  if (error === "callback_failed") {
    const byReason = reason ? CALLBACK_REASON_COPY[reason] : undefined;
    return byReason ?? "Sign-in link could not be verified. Send one fresh link and use it right away.";
  }
  if (!error) {
    return null;
  }
  return ERROR_COPY[error] ?? null;
}

async function getActiveSessionDestination(): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    await resolveIdentity(user.id);
    return "/dashboard";
  } catch {
    return null;
  }
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string; switched_account?: string }>;
}) {
  const { error, reason, switched_account: switchedAccount } = await searchParams;
  const errorMessage = getErrorMessage(error, reason);
  const activeSessionDestination = await getActiveSessionDestination();
  const showSessionRecoveryActions = reason === "session_mismatch" && Boolean(activeSessionDestination);
  const callbackTitle = reason ? CALLBACK_REASON_TITLES[reason] ?? "Sign-in issue" : "Sign-in issue";
  const infoMessage = switchedAccount ? ERROR_COPY.switched_account : null;

  return (
    <main className="min-h-screen bg-white md:grid md:grid-cols-[1fr_minmax(520px,620px)]">
      <section className="flex h-[388px] flex-col bg-brand-charcoal px-[22px] pb-[34px] pt-7 text-white md:h-auto md:px-14 md:py-14">
        <BrandLogo variant="lockup" reversed className="h-7 w-auto" priority />
        <div className="mt-auto max-w-[420px]">
          <h1 className="text-[30px] font-extrabold leading-[1.18] tracking-[-0.8px] md:text-[40px] md:tracking-[-1.1px]">
            Welcome to TeamFrame
          </h1>
          <p className="mt-4 max-w-[400px] text-[15.5px] leading-normal text-[#B0B8C2] md:text-[17px]">
            Sign in to access your workspace.
          </p>
        </div>
      </section>

      <section className="-mt-[14px] rounded-t-[14px] bg-white px-[22px] pb-6 pt-7 md:mt-0 md:flex md:flex-col md:justify-center md:rounded-none md:px-16">
        <div>
          <h2 className="text-[28px] font-extrabold leading-tight tracking-[-0.7px] text-ink-800">Sign in</h2>
          <p className="mt-2 text-[15.5px] text-ink-500">
            Use the email your workspace was set up with.
          </p>
        </div>

      {error === "callback_failed" && errorMessage ? (
        <section className="mt-8 rounded-xl border border-ink-300/80 bg-ink-100/50 px-4 py-4">
          <p className="text-[12px] uppercase tracking-[0.14em] text-ink-500">{callbackTitle}</p>
          <p role="alert" className="mt-2 text-[14px] text-ink-700">{errorMessage}</p>
          {showSessionRecoveryActions ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <form action={continueCurrentSessionAction} className="flex-1">
                <button
                  type="submit"
                  className="tf-primary-action h-12 w-full px-4 text-[14px]"
                >
                  Continue as current user
                </button>
              </form>
              <form action={switchAccountAction} className="flex-1">
                <button
                  type="submit"
                  className="tf-secondary-action h-12 w-full px-4 text-[14px] font-bold"
                >
                  Switch account
                </button>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}

      {infoMessage ? (
        <p className="mt-6 rounded-lg border border-ink-300/80 bg-white/80 px-4 py-3 text-[13px] text-ink-700">
          {infoMessage}
        </p>
      ) : null}

      {/* The callback failure is already explained in the panel above — do not repeat it under the form. */}
        <AuthForm errorMessage={error === "callback_failed" ? null : errorMessage} />

        <p className="mt-8 text-[12px] text-ink-500">
          Employees use magic links.{" "}
          <Link href="/admin/login" className="font-medium text-ink-900 underline-offset-4 hover:underline">
            Admin? Sign in here →
          </Link>
        </p>
      </section>
    </main>
  );
}
