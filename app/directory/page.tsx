import { AppShell } from "@/components/AppShell";
import { requireTenantActor } from "@/middleware/rbac";
import { listColleagueDirectory } from "@/services/employeeService";

export const dynamic = "force-dynamic";

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string; department?: string }> }) {
  const actor = await requireTenantActor();
  const colleagues = await listColleagueDirectory(actor);
  const params = await searchParams;
  const query = params.q?.trim().toLocaleLowerCase() ?? "";
  const department = params.department?.trim() ?? "";
  const departments = [...new Set(colleagues.map((person) => person.department).filter(Boolean))].sort();
  const filtered = colleagues.filter((person) => {
    const matchesQuery = !query || `${person.full_name} ${person.role_title}`.toLocaleLowerCase().includes(query);
    return matchesQuery && (!department || person.department === department);
  });
  return <main className="mx-auto max-w-5xl px-6 py-14"><AppShell actor={actor} activePath="/directory"/>
    <header className="border-b border-ink-300/60 pb-5"><p className="text-[12px] tracking-[0.14em] text-ink-500">Company</p><h1 className="mt-2 text-[34px] tracking-tight">Directory</h1><p className="mt-1 text-[14px] text-ink-500">Find a colleague using work information shared across your company.</p></header>
    <form className="tf-filter-strip mt-6 sm:grid-cols-[minmax(0,1fr)_220px_auto]" role="search">
      <label className="text-[12px] text-ink-600">Name or role<input name="q" defaultValue={params.q ?? ""} className="tf-input mt-1" placeholder="Search colleagues" /></label>
      <label className="text-[12px] text-ink-600">Department<select name="department" defaultValue={department} className="tf-select mt-1"><option value="">All departments</option>{departments.map((value) => <option key={value}>{value}</option>)}</select></label>
      <button className="tf-secondary-action self-end px-4 py-2 text-[13px]">Search</button>
    </form>
    <p className="mt-3 text-[12px] text-ink-500">{filtered.length} colleague{filtered.length === 1 ? "" : "s"}</p>
    <section className="mt-3 tf-surface-flat overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-left text-[13px]"><thead className="border-b border-ink-200 text-[11px] uppercase tracking-[0.1em] text-ink-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Manager</th><th className="px-4 py-3">Work email</th></tr></thead><tbody className="divide-y divide-ink-100">{filtered.length ? filtered.map((person) => <tr key={person.id}><td className="px-4 py-3 font-semibold">{person.full_name}</td><td className="px-4 py-3">{person.role_title}</td><td className="px-4 py-3">{person.department}</td><td className="px-4 py-3">{person.manager_name ?? "—"}</td><td className="px-4 py-3"><a href={`mailto:${person.email}`} className="hover:underline">{person.email}</a></td></tr>) : <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">No colleagues match those filters.</td></tr>}</tbody></table></div></section>
  </main>;
}
