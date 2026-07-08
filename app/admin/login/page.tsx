import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/db/supabaseServer";

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

  if (data.session.user.app_metadata?.role !== "admin") {
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <section className="rounded-2xl border border-ink-300/70 bg-white/85 p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-500">
            Admin access
          </p>
          <h1 className="text-[32px] leading-tight tracking-tight">Sign in to TeamFrame.</h1>
          <p className="text-[15px] text-ink-700">
            Sign in with your admin email and password. Employees sign in with a magic link instead.
          </p>
        </div>

        <form action={signInAdminAction} className="mt-8 space-y-4">
          <label htmlFor="email" className="sr-only">
            Email
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
            className="w-full rounded-full border border-ink-300 bg-white px-5 py-3 text-[15px] outline-none transition focus:border-ink-900"
          />

          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            className="w-full rounded-full border border-ink-300 bg-white px-5 py-3 text-[15px] outline-none transition focus:border-ink-900"
          />

          <button
            type="submit"
            className="w-full rounded-full bg-ink-900 px-5 py-3 text-[15px] font-medium text-paper transition hover:bg-ink-700"
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
