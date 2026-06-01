import { redirect } from "next/navigation";
import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { getEmployee } from "@/services/employeeService";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  task_completed: "Onboarding task marked complete.",
  leave_submitted: "Leave request submitted.",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status } = await searchParams;
  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;

  if (actor.role === "admin") {
    redirect("/dashboard");
  }

  if (!actor.employeeId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <nav className="mb-6 flex items-center gap-4 text-[14px] text-ink-500">
          <span className="text-ink-900 font-medium">Me</span>
          <Link href="/onboarding" className="hover:text-ink-900 transition">
            Onboarding
          </Link>
          <Link href="/leaves" className="hover:text-ink-900 transition">
            Leaves
          </Link>
          <SignOutButton className="ml-auto" />
        </nav>
        <section className="mt-8 rounded-xl border border-dashed border-ink-300/80 bg-white/60 p-8 text-center">
          <p className="text-[15px] text-ink-700">
            Your account is not yet linked to an employee profile.
          </p>
          <p className="mt-2 text-[14px] text-ink-500">
            Ask your admin to add you as an employee.
          </p>
        </section>
      </main>
    );
  }

  const employee = await getEmployee(actor, actor.employeeId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <nav className="mb-6 flex items-center gap-4 text-[14px] text-ink-500">
        <span className="text-ink-900 font-medium">Me</span>
        <Link href="/onboarding" className="hover:text-ink-900 transition">
          Onboarding
        </Link>
        <Link href="/leaves" className="hover:text-ink-900 transition">
          Leaves
        </Link>
        <SignOutButton className="ml-auto" />
      </nav>

      {successMessage ? (
        <p className="mt-0 mb-6 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">
          {successMessage}
        </p>
      ) : null}

      <div className="border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">My profile</p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">
          {employee.full_name}
        </h1>
        <p className="mt-1 text-[16px] text-ink-700">
          {employee.role_title} · {employee.department}
        </p>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <dt className="text-[12px] text-ink-500">Start date</dt>
          <dd className="mt-1 text-[16px] text-ink-900">{formatDate(employee.start_date)}</dd>
        </div>
        <div className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <dt className="text-[12px] text-ink-500">Employment type</dt>
          <dd className="mt-1 text-[16px] text-ink-900 capitalize">
            {employee.employment_type.replace(/_/g, " ")}
          </dd>
        </div>
        {employee.country ? (
          <div className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
            <dt className="text-[12px] text-ink-500">Country</dt>
            <dd className="mt-1 text-[16px] text-ink-900">{employee.country}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/onboarding"
          className="rounded-full border border-ink-300 px-5 py-2 text-[14px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
        >
          View onboarding
        </Link>
        <Link
          href="/leaves"
          className="rounded-full border border-ink-300 px-5 py-2 text-[14px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
        >
          Request leave
        </Link>
      </div>
    </main>
  );
}
