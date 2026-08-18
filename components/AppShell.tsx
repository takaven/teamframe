import Link from "next/link";
import type { Actor } from "@/middleware/rbac";
import { SignOutButton } from "@/components/SignOutButton";
import { BrandLogo } from "@/components/BrandLogo";

// Primary operational modules. Company (holidays) and Access are re-homed under
// Setup / Administration; Setup sits last as a secondary admin destination.
const ADMIN_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/org-chart", label: "Org chart" },
  { href: "/employees", label: "Employees" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/leaves", label: "Leave" },
  { href: "/policies", label: "Policies" },
] as const;

const SETUP_LINK = { href: "/setup", label: "Setup" } as const;

const EMPLOYEE_LINKS = [
  { href: "/me", label: "Me" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/me#policies", label: "Policies" },
  { href: "/leaves", label: "Leave" },
  { href: "/me#documents", label: "Documents" },
] as const;

export function AppShell({
  actor,
  activePath,
}: {
  actor: Actor;
  activePath: string;
}) {
  const isAdminSurface = actor.role === "admin";
  const links = isAdminSurface ? [...ADMIN_LINKS, SETUP_LINK] : EMPLOYEE_LINKS;

  return (
    <>
      <aside className="tf-app-shell flex flex-col px-0 py-[26px]" data-active={activePath} aria-label="Primary">
        <Link
          href={actor.role === "admin" ? "/dashboard" : "/me"}
          className="mx-5 flex items-center gap-2 text-white"
        >
          <BrandLogo variant="mark" reversed className="h-5 w-5" priority />
          <span className="text-[15px] font-extrabold tracking-tight">TeamFrame</span>
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
          <p className="text-[13px] font-semibold text-white">TeamFrame workspace</p>
          <p className="mt-1 text-[12.5px] text-[#B0B8C2]">People operations, made ready.</p>
          <SignOutButton className="mt-4" />
        </div>
      </aside>

      <header className="tf-mobile-bar bg-brand-charcoal text-white">
        <details className="group">
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-[18px] marker:hidden">
            <span className="flex items-center gap-2">
              <BrandLogo variant="mark" reversed className="h-[18px] w-[18px]" priority />
              <span className="text-[14.5px] font-extrabold tracking-tight">TeamFrame</span>
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
