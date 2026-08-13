import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireActor } from "@/middleware/rbac";
import { listPendingPlatformOwnerTransfersForActor } from "@/services/platformOwnerService";
import { acceptPlatformOwnerTransferAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PlatformOwnerTransferPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const actor = await requireActor();
  const transfers = await listPendingPlatformOwnerTransfersForActor(actor);
  const params = (await searchParams) ?? {};

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-14">
      <section className="tf-card w-full">
        <p className="tf-section-kicker">Platform Owner transfer</p>
        <h1 className="mt-2 text-3xl font-extrabold text-ink-800">Accept handover</h1>
        <p className="mt-4 text-[15px] leading-7 text-ink-600">
          Accepting Platform Owner handover requires an MFA-verified session.
        </p>
        {params.error ? <p className="mt-4 text-[13px] text-signal-red">{params.error}</p> : null}
        <div className="mt-6 divide-y divide-ink-100">
          {transfers.length === 0 ? <p className="py-3 text-[13px] text-ink-500">No pending transfer for this account.</p> : null}
          {transfers.map((transfer) => (
            <form key={transfer.id} action={acceptPlatformOwnerTransferAction} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <p className="font-bold text-ink-800">{transfer.replacement_display_name}</p>
                <p className="text-[13px] text-ink-500">{transfer.replacement_email}</p>
              </div>
              <input type="hidden" name="transfer_id" value={transfer.id} />
              <PendingSubmitButton idleLabel="Accept transfer" pendingLabel="Accepting..." className="tf-primary-action px-4 py-2 text-[13px]" />
            </form>
          ))}
        </div>
        <Link href="/admin/login" className="mt-6 inline-flex text-[13px] font-bold text-ink-600">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
