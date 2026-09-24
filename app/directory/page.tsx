import { AppShell } from "@/components/AppShell";
import { requireTenantActor } from "@/middleware/rbac";
import { listColleagueDirectory } from "@/services/employeeService";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const actor = await requireTenantActor();
  const colleagues = await listColleagueDirectory(actor);
  return <main className="mx-auto max-w-5xl px-6 py-14"><AppShell actor={actor} activePath="/directory"/>
    <header className="border-b border-ink-300/60 pb-5"><p className="text-[12px] tracking-[0.14em] text-ink-500">Company</p><h1 className="mt-2 text-[34px] tracking-tight">Directory</h1><p className="mt-1 text-[14px] text-ink-500">Find a colleague using work information shared across your company.</p></header>
    <section className="mt-7 tf-surface-flat overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-left text-[13px]"><thead className="border-b border-ink-200 text-[11px] uppercase tracking-[0.1em] text-ink-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Manager</th><th className="px-4 py-3">Work email</th></tr></thead><tbody className="divide-y divide-ink-100">{colleagues.map((person) => <tr key={person.id}><td className="px-4 py-3 font-semibold">{person.full_name}</td><td className="px-4 py-3">{person.role_title}</td><td className="px-4 py-3">{person.department}</td><td className="px-4 py-3">{person.manager_name ?? "—"}</td><td className="px-4 py-3"><a href={`mailto:${person.email}`} className="hover:underline">{person.email}</a></td></tr>)}</tbody></table></div></section>
  </main>;
}
