import { redirect } from "next/navigation";
import { z } from "zod";
import { BrandLogo } from "@/components/BrandLogo";
import { TakavenEndorsement } from "@/components/TakavenEndorsement";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { FloatingField } from "@/components/FloatingField";
import { createServerClient } from "@/lib/db/supabaseServer";
import { resolveIdentity, type Role } from "@/lib/rbac/roles";

const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  role: z.enum(["admin", "employee"]),
});

const ERROR_COPY: Record<string, string> = {
  disabled: "Founder review sign-in is not enabled in this environment.",
  invalid_credentials: "Email or password is incorrect.",
  access_denied: "That account cannot use this review role.",
};

function isReviewLoginEnabled(): boolean {
  return process.env.TEAMFRAME_REVIEW_PASSWORD_AUTH === "true";
}

function roleDestination(role: Role): string {
  return role === "admin" ? "/dashboard" : "/home";
}

async function reviewSignInAction(formData: FormData): Promise<void> {
  "use server";

  if (!isReviewLoginEnabled()) {
    redirect("/review/login?error=disabled");
  }

  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  const role = parsed.success ? parsed.data.role : "employee";
  const emailParam =
    parsed.success && parsed.data.email.length <= 254 ? `&email=${encodeURIComponent(parsed.data.email)}` : "";
  const roleParam = `role=${role}`;

  if (!parsed.success) {
    redirect(`/review/login?${roleParam}&error=invalid_credentials${emailParam}`);
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.session?.user) {
    redirect(`/review/login?${roleParam}&error=invalid_credentials${emailParam}`);
  }

  const identity = await resolveIdentity(data.session.user.id);
  if (identity.role !== parsed.data.role) {
    await supabase.auth.signOut();
    redirect(`/review/login?${roleParam}&error=access_denied${emailParam}`);
  }

  redirect(roleDestination(identity.role));
}

export default async function FounderReviewLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; role?: string }>;
}) {
  const { error, email, role } = await searchParams;
  const requestedRole = role === "admin" ? "admin" : "employee";
  const errorMessage = error ? ERROR_COPY[error] : null;
  const enabled = isReviewLoginEnabled();
  const prefillEmail = typeof email === "string" ? email.slice(0, 254) : "";

  return (
    <main className="tf-auth-page">
      <div className="tf-auth-panel">
      <section className="tf-auth-brand-panel">
        <BrandLogo variant="lockup" className="h-7 w-auto" priority />
        <div className="mt-auto max-w-[440px]">
          <h1 className="text-[30px] font-extrabold leading-[1.18] tracking-[-0.8px] md:text-[40px] md:tracking-[-1.1px]">
            Welcome to TeamFrame
          </h1>
          <p className="mt-4 max-w-[400px] text-[15.5px] leading-normal text-[#B0B8C2] md:text-[17px]">
            A focused HR workspace for your people, roles and records.
          </p>
        </div>
        <TakavenEndorsement className="mt-10" />
      </section>

      <section className="tf-auth-card">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">Review environment</p>
          <h2 className="tf-auth-title mt-3">Log in</h2>
          <p className="mt-2 text-[15.5px] text-ink-500">
            Use your review credentials to access TeamFrame
            {requestedRole === "admin" ? " as an administrator." : "."}
          </p>
        </div>

        <form action={reviewSignInAction} className="mt-[34px] space-y-[22px]">
          <input type="hidden" name="role" value={requestedRole} />
          <FloatingField
            label="Work email"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            inputMode="email"
            defaultValue={prefillEmail}
          />
          <FloatingField
            label="Password"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />

          <PendingSubmitButton
            idleLabel="Enter"
            pendingLabel="Signing in…"
            disabled={!enabled}
            disabledLabel="Sign in"
            className="tf-brand-action tf-auth-submit h-12 w-full px-5 text-[15px]"
          />

          {errorMessage || !enabled ? (
            <p role="alert" className="text-[13px] text-signal-red">
              {errorMessage ?? ERROR_COPY.disabled}
            </p>
          ) : null}
        </form>
      </section>
      </div>
    </main>
  );
}
