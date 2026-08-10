import { logoutAction } from "@/app/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction} className={className}>
      <button
        type="submit"
        className="rounded-lg border border-white/25 px-3 py-2 text-[12px] text-white transition hover:border-brand-signal"
      >
        Sign out
      </button>
    </form>
  );
}
