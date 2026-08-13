import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/db/supabaseServer";
import { resolveIdentity } from "@/lib/rbac/roles";
import { BrandLogo } from "@/components/BrandLogo";

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
          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-500">
            Admin access
          </p>
          <h2 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.7px] text-ink-800">Sign in</h2>
          <p className="mt-2 text-[15.5px] text-ink-500">
            Use your admin email and password.
          </p>
        </div>

        <form action={signInAdminAction} className="mt-[34px] space-y-[18px]">
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
            placeholder="admin@company.com"
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
            className="tf-primary-action h-12 w-full px-5 text-[15px]"
          >
            Sign in
          </button>

          {errorMessage ? (
            <p role="alert" className="text-[13px] text-signal-red">
              {errorMessage}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
