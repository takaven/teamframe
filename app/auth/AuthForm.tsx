"use client";

import { useFormStatus } from "react-dom";
import { sendMagicLink } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="tf-brand-action h-12 w-full px-5 text-[15px] disabled:cursor-not-allowed disabled:bg-ink-300"
    >
      {pending ? "Sending…" : "Continue"}
    </button>
  );
}

export function AuthForm({ errorMessage }: { errorMessage: string | null }) {
  return (
    <form action={sendMagicLink} className="mt-[34px] space-y-[18px]">
      <label htmlFor="email" className="block text-[13px] font-bold text-ink-800">
        Work email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        inputMode="email"
        placeholder="you@company.com"
        className="h-12 w-full rounded-lg border border-ink-300 bg-white px-[14px] text-[15px] text-ink-800 outline-none transition focus:border-ink-800"
      />
      <SubmitButton />

      {errorMessage ? (
        <p role="alert" className="text-[13px] text-signal-red">
          {errorMessage}
        </p>
      ) : null}
      <p className="text-[13.5px] leading-relaxed text-ink-500">
        Team members use the same address to reach their own onboarding, policies, documents and leave.
      </p>
    </form>
  );
}
