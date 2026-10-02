import { cookies } from "next/headers";
import { UpdatePasswordForm } from "./UpdatePasswordForm";
import { createServerClient } from "@/lib/db/supabaseServer";
import { isServerRecoveryBoundToUser, RECOVERY_COOKIE_NAME } from "@/lib/auth/recovery";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const [{ reason }, cookieStore, supabase] = await Promise.all([
    searchParams,
    cookies(),
    createServerClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const serverVerifiedRecovery = isServerRecoveryBoundToUser(
    cookieStore.get(RECOVERY_COOKIE_NAME)?.value,
    user?.id,
  );

  return (
    <UpdatePasswordForm
      serverVerifiedRecovery={serverVerifiedRecovery}
      invalidReason={reason ?? null}
    />
  );
}
