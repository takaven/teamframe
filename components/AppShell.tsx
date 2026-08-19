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

  return (
    <>
      <aside className="tf-app-shell flex flex-col px-0 py-[26px]" data-active={activePath} aria-label="Primary">
        <Link href={workspaceHome} className="mx-5 flex items-center gap-2.5 text-white" aria-label={`${identity.name} — TeamFrame`}>
          {identity.logoUrl ? (
            <Image
              src={identity.logoUrl}
              alt={identity.name}
              width={28}
              height={28}
              className="h-7 w-7 rounded-md object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-signal text-[12px] font-extrabold text-ink-900">
              {identity.monogram}
            </span>
          )}
          <span className="min-w-0 truncate text-[15px] font-extrabold tracking-tight">{identity.name}</span>
        </Link>

        <nav className="mt-[30px]" aria-label={actor.role === "admin" ? "Admin" : "Employee"}>
          {links.map((link) => {
            const active = link.href === activePath || (link.href.startsWith(`${activePath}#`) && activePath === "/me");
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative block px-5 py-[11px] text-[14px] transition",
                  active ? "font-bold text-white before:absolute before:left-0 before:top-[9px] before:bottom-[9px] before:w-[2px] before:bg-brand-signal" : "font-semibold text-ink-400 hover:text-white",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-5">
          <SignOutButton className="mb-5" />
          <div className="flex items-center gap-2 border-t border-white/10 pt-4">
            <BrandLogo variant="mark" reversed className="h-4 w-4 opacity-80" />
            <span className="text-[12px] font-semibold text-[#B0B8C2]">Powered by TeamFrame</span>
          </div>
        </div>
      </aside>

      <header className="tf-mobile-bar bg-brand-charcoal text-white">
        <details className="group">
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-[18px] marker:hidden">
            <span className="flex min-w-0 items-center gap-2">
              {identity.logoUrl ? (
                <Image src={identity.logoUrl} alt={identity.name} width={22} height={22} className="h-[22px] w-[22px] rounded object-cover" unoptimized />
              ) : (
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded bg-brand-signal text-[11px] font-extrabold text-ink-900">
                  {identity.monogram}
                </span>
              )}
              <span className="min-w-0 truncate text-[14.5px] font-extrabold tracking-tight">{identity.name}</span>
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
