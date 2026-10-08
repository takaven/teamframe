"use server";

import { redirect } from "next/navigation";
import { requireTenantActor } from "@/middleware/rbac";
import type { EmployeeDocumentRequestType } from "@/lib/employeeDocumentRequests";
import {
  completeEmployeeDocumentRequest,
  createEmployeeDocumentRequest,
  getEmployeeDocumentRequestDownloadUrl,
  markEmployeeDocumentRequestInProgress,
} from "@/services/employeeDocumentRequestService";

function text(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function safeReturnPath(value: string | undefined, fallback: string): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function errorCode(error: unknown): string {
  if (!(error instanceof Error)) return "UNKNOWN";
  if (error.name === "ZodError") return "INVALID_INPUT";
  const code = error.message.split(":", 1)[0] ?? "UNKNOWN";
  return code || "UNKNOWN";
}

function withQuery(path: string, key: "status" | "error", value: string): string {
  const [rawBase, hash] = path.split("#", 2);
  const base = rawBase || "/";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
}

export async function createEmployeeDocumentRequestAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnPath(text(formData.get("return_to")), "/documents-and-policies#requested-documents");
  try {
    const actor = await requireTenantActor();
    await createEmployeeDocumentRequest(actor, {
      requestType: text(formData.get("request_type")) as EmployeeDocumentRequestType,
      details: text(formData.get("details")),
      neededBy: text(formData.get("needed_by")),
    });
  } catch (error) {
    redirect(withQuery(returnTo, "error", errorCode(error)));
  }
  redirect(withQuery(returnTo, "status", "document_request_created"));
}

export async function markEmployeeDocumentRequestInProgressAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnPath(text(formData.get("return_to")), "/documents?view=employee-requests");
  try {
    const actor = await requireTenantActor();
    const requestId = text(formData.get("request_id"));
    if (!requestId) throw new Error("INVALID_INPUT");
    await markEmployeeDocumentRequestInProgress(actor, requestId);
  } catch (error) {
    redirect(withQuery(returnTo, "error", errorCode(error)));
  }
  redirect(withQuery(returnTo, "status", "document_request_in_progress"));
}

export async function completeEmployeeDocumentRequestAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnPath(text(formData.get("return_to")), "/documents?view=employee-requests");
  try {
    const actor = await requireTenantActor();
    const requestId = text(formData.get("request_id"));
    const file = formData.get("file");
    if (!requestId || !(file instanceof File) || file.size === 0) throw new Error("INVALID_INPUT");
    await completeEmployeeDocumentRequest(actor, { requestId, file });
  } catch (error) {
    redirect(withQuery(returnTo, "error", errorCode(error)));
  }
  redirect(withQuery(returnTo, "status", "document_request_ready"));
}

export async function downloadEmployeeDocumentRequestAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnPath(text(formData.get("return_to")), "/documents-and-policies#requested-documents");
  let url: string;
  try {
    const actor = await requireTenantActor();
    const requestId = text(formData.get("request_id"));
    if (!requestId) throw new Error("INVALID_INPUT");
    url = await getEmployeeDocumentRequestDownloadUrl(actor, requestId);
  } catch (error) {
    redirect(withQuery(returnTo, "error", errorCode(error)));
  }
  redirect(url!);
}
