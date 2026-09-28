import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/db/supabaseServer";
import { resolveIdentity } from "@/lib/rbac/roles";
import { BrandLogo } from "@/components/BrandLogo";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { FloatingField } from "@/components/FloatingField";

const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  access_denied: "Access denied",
};

async function signInAdminAction(formData: FormData): Promise<void> {
  "use server";

  // Keep the typed email across a failed attempt so the admin only has to
  // re-enter the password. Never carry the password.
  const rawEmail = formData.get("email");
  const emailParam =
    typeof rawEmail === "string" && rawEmail.length > 0 && rawEmail.length <= 254
      ? `&email=${encodeURIComponent(rawEmail.trim())}`
      : "";

  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/admin/login?error=invalid_credentials${emailParam}`);
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.session?.user) {
    redirect(`/admin/login?error=invalid_credentials${emailParam}`);
  }

  const identity = await resolveIdentity(data.session.user.id);
  if (data.session.user.app_metadata?.role !== "admin" && identity.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/admin/login?error=access_denied");
  }

  redirect("/dashboard");
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const { error, email } = await searchParams;
  const errorMessage = error ? ERROR_COPY[error] : null;
  const prefillEmail = error && typeof email === "string" ? email.slice(0, 254) : "";

  return (
    <main className="tf-auth-page">
      <div className="tf-auth-panel">
      <section className="tf-auth-brand-panel">
        <BrandLogo variant="lockup" className="h-7 w-auto" priority />
        <div className="mt-auto max-w-[420px]">
          <h1 className="text-[30px] font-extrabold leading-[1.18] tracking-[-0.8px] md:text-[40px] md:tracking-[-1.1px]">
            Welcome to TeamFrame
          </h1>
          <p className="mt-4 max-w-[400px] text-[15.5px] leading-normal text-[#B0B8C2] md:text-[17px]">
            Sign in to access your workspace.
          </p>
        </div>
      </section>

      <section className="tf-auth-card">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-500">
            Admin access
          </p>
          <h2 className="tf-auth-title mt-3">Log in</h2>
          <p className="mt-2 text-[15.5px] text-ink-500">
            Use your admin email and password.
          </p>
        </div>

        <form action={signInAdminAction} className="mt-[34px] space-y-[22px]">
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
            pendingLabel="Signing you in…"
            className="tf-brand-action tf-auth-submit h-12 w-full px-5 text-[15px]"
          />

          {errorMessage ? (
            <p role="alert" className="text-[13px] text-signal-red">
              {errorMessage}
            </p>
          ) : null}
        </form>
      </section>
      </div>
    </main>
  );
}
