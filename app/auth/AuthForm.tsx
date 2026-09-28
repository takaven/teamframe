"use client";

import { useFormStatus } from "react-dom";
import { sendMagicLink } from "./actions";
import { FloatingField } from "@/components/FloatingField";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="tf-brand-action tf-auth-submit h-12 w-full px-5 text-[15px]"
      aria-busy={pending}
    >
      {pending ? <span className="tf-inline-loader" aria-hidden="true" /> : null}
      <span>{pending ? "Sending…" : "Enter"}</span>
    </button>
  );
}

export function AuthForm({ errorMessage }: { errorMessage: string | null }) {
  return (
    <form action={sendMagicLink} className="mt-[34px] space-y-[22px]">
      <FloatingField
        label="Work email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        inputMode="email"
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
