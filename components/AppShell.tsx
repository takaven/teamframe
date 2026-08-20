import Link from "next/link";
import Image from "next/image";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { SignOutButton } from "@/components/SignOutButton";
import { BrandLogo } from "@/components/BrandLogo";
import { getCompanyIdentity } from "@/lib/company/identity";

// Primary operational modules. Company (holidays) and Access are re-homed under
// Setup / Administration; Setup sits last as a secondary admin destination.
// Lean primary operational navigation. Early-employment (probation outcome + 30-day check-in
// oversight) is a secondary lifecycle destination reached contextually from Onboarding, not a
// permanent top-level module. Company/Access/Guided Setup live under Setup.
const ADMIN_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/org-chart", label: "Org chart" },
  { href: "/employees", label: "Employees" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/leaves", label: "Leave" },
  { href: "/policies", label: "Policies" },
] as const;

const SETUP_LINK = { href: "/setup", label: "Setup" } as const;

// Documents and Policies are sections within /me, not separate destinations.
const EMPLOYEE_LINKS = [
  { href: "/me", label: "Me" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/leaves", label: "Leave" },
] as const;

const MY_TEAM_LINK = { href: "/manager", label: "My Team" } as const;

// Manager status = the employee currently has at least one direct report.
async function hasDirectReports(actor: Actor): Promise<boolean> {
  if (actor.role === "admin" || !actor.employeeId || !actor.tenantId) return false;
  try {
    const supabase = createServiceRoleClient();
    const { count } = await supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", actor.tenantId)
      .eq("manager_id", actor.employeeId)
      .is("deleted_at", null);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function AppShell({
  actor,
  activePath,
}: {
  actor: Actor;
  activePath: string;
}) {
  const isAdminSurface = actor.role === "admin";
  const [showMyTeam, identity] = await Promise.all([
    isAdminSurface ? Promise.resolve(false) : hasDirectReports(actor),
    getCompanyIdentity(actor.tenantId),
  ]);
  const links = isAdminSurface
    ? [...ADMIN_LINKS, SETUP_LINK]
    : (showMyTeam ? [...EMPLOYEE_LINKS, MY_TEAM_LINK] : [...EMPLOYEE_LINKS]);

  const workspaceHome = actor.role === "admin" ? "/dashboard" : "/me";

  const primaryLinks = isAdminSurface ? ADMIN_LINKS : (showMyTeam ? [...EMPLOYEE_LINKS, MY_TEAM_LINK] : [...EMPLOYEE_LINKS]);
  const isActive = (href: string) => href === activePath || (href.startsWith(`${activePath}#`) && activePath === "/me");

  return (
    <>
      <aside className="tf-app-shell flex flex-col py-6" data-active={activePath} aria-label="Primary">
        {/* Product identity — TeamFrame stays visible after login. */}
        <Link href={workspaceHome} className="mx-5 flex items-center gap-2 text-white" aria-label="TeamFrame">
          <BrandLogo variant="mark" reversed className="h-6 w-6" priority />
          <span className="text-[16px] font-extrabold tracking-tight">TeamFrame</span>
        </Link>

        {/* Customer workspace context (not replacement branding). */}
        <div className="mx-3 mt-4 flex items-center gap-2.5 rounded-lg bg-white/[0.06] px-3 py-2.5">
          {identity.logoUrl ? (
            <Image src={identity.logoUrl} alt="" width={26} height={26} className="h-[26px] w-[26px] shrink-0 rounded-md object-cover" unoptimized />
          ) : (
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-brand-signal text-[11px] font-extrabold text-ink-900">
              {identity.monogram}
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/40">Workspace</span>
            <span className="block min-w-0 truncate text-[13px] font-semibold text-white">{identity.name}</span>
          </span>
        </div>

        <nav className="mt-6 flex-1" aria-label={actor.role === "admin" ? "Admin" : "Employee"}>
          {primaryLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative mx-3 flex items-center rounded-lg px-3 py-2 text-[14px] transition",
                  active ? "bg-white/[0.08] font-semibold text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2.5px] before:rounded-full before:bg-brand-signal" : "font-medium text-ink-400 hover:bg-white/[0.04] hover:text-white",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}

          {isAdminSurface ? (
            <>
              <div className="mx-5 my-3 border-t border-white/10" />
              <Link
                href={SETUP_LINK.href}
                aria-current={isActive(SETUP_LINK.href) ? "page" : undefined}
                className={[
                  "relative mx-3 flex items-center rounded-lg px-3 py-2 text-[13.5px] transition",
                  isActive(SETUP_LINK.href) ? "bg-white/[0.08] font-semibold text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2.5px] before:rounded-full before:bg-brand-signal" : "font-medium text-ink-500 hover:bg-white/[0.04] hover:text-white",
                ].join(" ")}
              >
                {SETUP_LINK.label}
              </Link>
            </>
          ) : null}
        </nav>

        {/* Account + quiet parent-company endorsement. */}
        <div className="mt-auto px-5">
          <SignOutButton className="mb-4" />
          <p className="border-t border-white/10 pt-4 text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/35">
            Conceptualised by <span className="text-white/55">TAKAVEN</span>
          </p>
        </div>
      </aside>

      <header className="tf-mobile-bar bg-brand-charcoal text-white">
        <details className="group">
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-[18px] marker:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <BrandLogo variant="mark" reversed className="h-[20px] w-[20px]" priority />
              <span className="text-[14.5px] font-extrabold tracking-tight">TeamFrame</span>
              <span className="ml-1 min-w-0 truncate border-l border-white/20 pl-2 text-[12.5px] font-medium text-white/60">{identity.name}</span>
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-lg text-[24px] leading-none group-open:hidden" aria-hidden="true">
              =
            </span>
            <span className="hidden h-11 w-11 items-center justify-center rounded-lg text-[24px] leading-none group-open:flex" aria-hidden="true">
              ×
            </span>
          </summary>
          <nav className="rounded-b-[14px] bg-white pb-3 pt-2 text-ink-500 shadow-[0_18px_44px_-30px_rgba(15,17,21,.45)]" aria-label="Mobile primary">
            {links.map((link) => {
              const active = link.href === activePath || (link.href.startsWith(`${activePath}#`) && activePath === "/me");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative flex h-14 items-center px-[18px] text-[15.5px]",
                    active ? "font-extrabold text-ink-800 before:absolute before:left-0 before:top-[14px] before:bottom-[14px] before:w-[2px] before:bg-brand-signal" : "font-semibold",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
            <p className="px-[18px] pt-2 text-[13px] text-ink-500">
              Documents and exports are reached from the records they belong to.
            </p>
          </nav>
        </details>
      </header>
    </>
  );
}
