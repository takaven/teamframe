import { logoutAction } from "@/app/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction} className={className}>
      <button
        type="submit"
        className="rounded-full border border-current/25 px-3 py-1 text-[12px] text-inherit transition hover:border-brand-signal hover:text-white"
      >
        Sign out
      </button>
    </form>
  );
}
