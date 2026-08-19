"use client";

import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/auth/actions";

function SignOutSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="rounded-lg border border-white/25 px-3 py-2 text-[12px] text-white transition hover:border-brand-signal disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction} className={className}>
      <SignOutSubmit />
    </form>
  );
}
