import { redirect } from "next/navigation";
import { z } from "zod";
import { BrandLogo } from "@/components/BrandLogo";
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
  return role === "admin" ? "/dashboard" : "/me";
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
    <main className="min-h-screen bg-white md:grid md:grid-cols-[1fr_minmax(520px,620px)]">
      <section className="flex h-[388px] flex-col bg-brand-charcoal px-[22px] pb-[34px] pt-7 text-white md:h-auto md:px-14 md:py-14">
        <BrandLogo variant="mark" reversed className="h-6 w-6" priority />
        <div className="mt-auto max-w-[420px]">
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#B0B8C2]">Founder review</p>
          <h1 className="mt-3 text-[30px] font-extrabold leading-[1.18] tracking-[-0.8px] md:text-[40px] md:tracking-[-1.1px]">
            People operations, made ready.
          </h1>
          <p className="mt-4 max-w-[400px] text-[15.5px] leading-normal text-[#B0B8C2] md:text-[17px]">
            Synthetic, non-production review access.
          </p>
        </div>
      </section>

      <section className="-mt-[14px] rounded-t-[14px] bg-white px-[22px] pb-6 pt-7 md:mt-0 md:flex md:flex-col md:justify-center md:rounded-none md:px-16">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-500">
            {requestedRole === "admin" ? "Admin review access" : "Employee review access"}
          </p>
          <h2 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.7px] text-ink-800">Sign in</h2>
          <p className="mt-2 text-[15.5px] text-ink-500">
            Use the synthetic review credentials supplied for this non-production environment.
          </p>
        </div>

        <form action={reviewSignInAction} className="mt-[34px] space-y-[18px]">
          <input type="hidden" name="role" value={requestedRole} />
          <label htmlFor="email" className="block text-[13px] font-bold text-ink-800">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            inputMode="email"
            defaultValue={prefillEmail}
            placeholder={requestedRole === "admin" ? "admin@example.com" : "employee@example.com"}
            className="h-12 w-full rounded-lg border border-ink-300 bg-white px-[14px] text-[15px] text-ink-800 outline-none transition focus:border-ink-800"
          />

          <label htmlFor="password" className="block text-[13px] font-bold text-ink-800">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            className="h-12 w-full rounded-lg border border-ink-300 bg-white px-[14px] text-[15px] text-ink-800 outline-none transition focus:border-ink-800"
          />

          <button
            type="submit"
            disabled={!enabled}
            className="tf-primary-action h-12 w-full px-5 text-[15px] disabled:cursor-not-allowed disabled:bg-ink-300"
          >
            Sign in
          </button>

          {errorMessage || !enabled ? (
            <p role="alert" className="text-[13px] text-signal-red">
              {errorMessage ?? ERROR_COPY.disabled}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
