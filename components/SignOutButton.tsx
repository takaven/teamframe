import { logoutAction } from "@/app/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction} className={className}>
      <button
        type="submit"
        className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
      >
        Sign out
      </button>
    </form>
  );
}
