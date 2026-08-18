import { uploadRequirementDocumentAction } from "@/app/employees/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { StatusPill } from "@/components/StatusPill";

// Groups the EXISTING document_requirements states into a useful employee checklist.
// No new document system — this only derives buckets from the current model.

type Requirement = {
  id: string;
  document_type: string;
  state: string;
  due_date: string | null;
  review_required: boolean;
  employee_upload_allowed: boolean;
};

function fmt(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Bucket derivation from the requirement state (+ review flag).
function bucketOf(r: Requirement): string {
  if (r.state === "accepted") return "Accepted";
  if (r.state === "expired") return "Expired · needs attention";
  if (r.state === "rejected") return "Needs re-upload";
  if (r.state === "received") return r.review_required ? "Awaiting review" : "Accepted";
  if (r.state === "requested") return r.employee_upload_allowed ? "Upload required" : "Required";
  return null as unknown as string; // replaced / cancelled → hidden
}

const BUCKET_ORDER = ["Upload required", "Required", "Needs re-upload", "Expired · needs attention", "Awaiting review", "Accepted"];
const BUCKET_TONE: Record<string, "amber" | "red" | "neutral" | "green"> = {
  "Upload required": "amber", "Required": "amber", "Needs re-upload": "red",
  "Expired · needs attention": "red", "Awaiting review": "neutral", "Accepted": "green",
};

function UploadForm({ requirement }: { requirement: Requirement }) {
  if (!requirement.employee_upload_allowed) return null;
  if (!["requested", "rejected", "expired", "accepted"].includes(requirement.state)) return null;
  const label = requirement.state === "accepted" ? "Replace" : "Upload";
  return (
    <form action={uploadRequirementDocumentAction} className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px_auto]" encType="multipart/form-data">
      <input type="hidden" name="requirement_id" value={requirement.id} />
      <input type="hidden" name="return_to" value="/me" />
      <input name="file" type="file" required className="rounded-md border border-ink-300 bg-white px-2 py-1.5 text-[12px] text-ink-900" />
      <input name="expires_at" type="date" className="rounded-md border border-ink-300 bg-white px-2 py-1.5 text-[12px] text-ink-900" />
      <PendingSubmitButton idleLabel={label} pendingLabel="Uploading…" className="rounded-md bg-brand-signal px-3 py-1.5 text-[12px] font-medium text-ink-800 disabled:bg-ink-300" />
    </form>
  );
}

export function DocumentsChecklist({ requirements }: { requirements: Requirement[] }) {
  const grouped = new Map<string, Requirement[]>();
  for (const r of requirements) {
    const b = bucketOf(r);
    if (!b) continue;
    if (!grouped.has(b)) grouped.set(b, []);
    grouped.get(b)!.push(r);
  }
  const outstanding = requirements.filter((r) => bucketOf(r) && bucketOf(r) !== "Accepted").length;

  if (requirements.length === 0) {
    return <p className="rounded-md border border-ink-300/50 bg-ink-100/40 px-3 py-2 text-[13px] text-ink-500">No document requests are currently assigned to you.</p>;
  }

  return (
    <div className="space-y-4">
      <StatusPill tone={outstanding > 0 ? "amber" : "green"}>{outstanding} outstanding</StatusPill>
      {BUCKET_ORDER.filter((b) => grouped.has(b)).map((bucket) => (
        <div key={bucket}>
          <div className="flex items-center gap-2">
            <StatusPill tone={BUCKET_TONE[bucket] ?? "neutral"}>{bucket}</StatusPill>
            <span className="text-[12px] text-ink-500">{grouped.get(bucket)!.length}</span>
          </div>
          <ul className="mt-2 divide-y divide-ink-100 rounded-lg border border-ink-200">
            {grouped.get(bucket)!.map((r) => (
              <li key={r.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-ink-900">{r.document_type.replace(/_/g, " ")}</span>
                  <span className="text-[12px] text-ink-500">{r.due_date ? `Due ${fmt(r.due_date)}` : ""}{r.review_required ? " · review required" : ""}</span>
                </div>
                <UploadForm requirement={r} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
