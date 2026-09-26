import { redirect } from "next/navigation";
import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { getEmployeeMasterRecord } from "@/services/employeeMasterService";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { EmployeeSelfRecord } from "@/components/EmployeeSelfRecord";
import { LegacyMeHashRedirect } from "@/components/LegacyMeHashRedirect";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  profile_updated: "Your details were saved.",
  payment_updated: "Payment details saved.",
  photo_updated: "Profile photo updated.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_EMPLOYEE_RECORD: "Your account is not linked to an employee profile yet. Ask your admin.",
  NO_TENANT_CONTEXT: "Session error — please sign out and back in.",
  INVALID_INPUT: "Some details were not valid. Check the fields and try again.",
  PHOTO_UNSUPPORTED_TYPE: "Profile photos must be PNG, JPEG or WebP.",
  PHOTO_TOO_LARGE: "Profile photos must be 5 MB or smaller.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

export default async function MePage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;
  if (actor.role === "admin") redirect("/dashboard");

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (!actor.employeeId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <AppShell actor={actor} activePath="/me" />
        <EmptyState className="mt-8" message="Your account is not yet linked to an employee profile." hint="Ask your admin to add you as an employee." />
      </main>
    );
  }

  const record = await getEmployeeMasterRecord(actor, actor.employeeId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <LegacyMeHashRedirect />
      <AppShell actor={actor} activePath="/me" />
      <header className="border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Me</p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">My profile</h1>
        <p className="mt-1 text-[14px] text-ink-500">Keep your personal, contact and payment details up to date.</p>
      </header>
      {successMessage ? <p role="status" aria-live="polite" className="mt-6 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">{successMessage}</p> : null}
      {errorMessage ? <p role="alert" className="mt-6 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">{errorMessage}</p> : null}
      <section className="mt-7">
        <div className="flex items-center gap-4 border-b border-ink-200 pb-5">
          <EmployeeAvatar name={record.identity.full_name} photoUrl={record.identity.photo_url} size={56} />
          <div>
            <h2 className="text-[24px] font-semibold tracking-tight">{record.identity.full_name}</h2>
            <p className="mt-1 text-[14px] text-ink-700">{record.employment.role_title} · {record.employment.department}</p>
          </div>
        </div>
        <div className="mt-5"><EmployeeSelfRecord record={record} /></div>
      </section>
      <nav className="mt-7 flex flex-wrap gap-3" aria-label="Related self-service">
        <Link href="/documents-and-policies" className="tf-secondary-action px-5 py-2 text-[14px]">Documents &amp; policies</Link>
        <Link href="/leaves" className="tf-secondary-action px-5 py-2 text-[14px]">Time off</Link>
      </nav>
    </main>
  );
}
