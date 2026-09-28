import { uploadRequirementDocumentAction } from "@/app/employees/actions";
import { DateField } from "@/components/DateField";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { FileInput } from "@/components/FileInput";
import { StatusPill } from "@/components/StatusPill";
import { documentLabel } from "@/lib/ui/documentLabels";

// Groups the EXISTING document_requirements states into a useful employee checklist.
// No new document system — this only derives buckets from the current model.

type Requirement = {
  id: string;
  document_type: string;
  state: string;
  due_date: string | null;
  review_required: boolean;
  employee_upload_allowed: boolean;
  current_expires_at: string | null;
};

const EXPIRING_SOON_DAYS = 30;

function fmt(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Bucket derivation from the requirement state (+ review flag + current document expiry).
function bucketOf(r: Requirement): string {
  if (r.state === "expired") return "Expired · needs attention";
  if (r.state === "rejected") return "Needs re-upload";
  if (r.state === "requested") return r.employee_upload_allowed ? "Upload required" : "Required";
  if (r.state === "accepted" || (r.state === "received" && !r.review_required)) {
    // Derive Expiring soon / Expired from the accepted document's expiry.
    if (r.current_expires_at) {
      const days = Math.floor((new Date(r.current_expires_at).getTime() - new Date().getTime()) / 86_400_000);
      if (days < 0) return "Expired · needs attention";
      if (days <= EXPIRING_SOON_DAYS) return "Expiring soon";
    }
    return "Accepted";
  }
  if (r.state === "received") return "Awaiting review";
  return null as unknown as string; // replaced / cancelled → hidden
}

const BUCKET_ORDER = ["Upload required", "Required", "Needs re-upload", "Expired · needs attention", "Expiring soon", "Awaiting review", "Accepted"];
const BUCKET_TONE: Record<string, "amber" | "red" | "neutral" | "green"> = {
  "Upload required": "amber", "Required": "amber", "Needs re-upload": "red",
  "Expired · needs attention": "red", "Expiring soon": "amber", "Awaiting review": "neutral", "Accepted": "green",
};

function UploadForm({ requirement, returnTo }: { requirement: Requirement; returnTo: string }) {
  if (!requirement.employee_upload_allowed) return null;
  if (!["requested", "rejected", "expired", "accepted"].includes(requirement.state)) return null;
  const label = requirement.state === "accepted" ? "Replace" : "Upload";
  return (
    <form action={uploadRequirementDocumentAction} className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px_auto]" encType="multipart/form-data">
      <input type="hidden" name="requirement_id" value={requirement.id} />
      <input type="hidden" name="return_to" value={returnTo} />
      <FileInput name="file" required label="Choose a file" />
      <label className="text-[12px] text-ink-500">Expiry date (optional)<DateField name="expires_at" dense /></label>
      <PendingSubmitButton idleLabel={label} pendingLabel="Uploading…" className="tf-primary-action px-3 py-1.5 text-[12px] font-medium disabled:bg-ink-300" />
    </form>
  );
}

export function DocumentsChecklist({ requirements, returnTo = "/documents-and-policies#documents" }: { requirements: Requirement[]; returnTo?: string }) {
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
      <p className="text-[13px] font-medium text-ink-700">
        {outstanding > 0 ? `${outstanding} document${outstanding === 1 ? "" : "s"} required` : "Documents complete"}
      </p>
      {BUCKET_ORDER.filter((b) => grouped.has(b)).map((bucket) => (
        <div key={bucket}>
          {grouped.size > 1 ? <div className="flex items-center gap-2"><StatusPill tone={BUCKET_TONE[bucket] ?? "neutral"}>{bucket}</StatusPill><span className="text-[12px] text-ink-600">{grouped.get(bucket)!.length}</span></div> : null}
          <ul className={`${grouped.size > 1 ? "mt-2" : ""} divide-y divide-ink-100 rounded-lg border border-ink-200`}>
            {grouped.get(bucket)!.map((r) => (
              <li key={r.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-ink-900">{documentLabel(r.document_type)}</span>
                  <span className="text-[12px] text-ink-500">
                    {r.due_date ? (new Date(`${r.due_date}T23:59:59`).getTime() < Date.now() && !["accepted", "received"].includes(r.state) ? `Overdue — was due ${fmt(r.due_date)}` : `Due ${fmt(r.due_date)}`) : ""}
                    {r.review_required ? " · review required" : ""}
                  </span>
                </div>
                <UploadForm requirement={r} returnTo={returnTo} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
