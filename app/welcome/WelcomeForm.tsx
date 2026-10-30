"use client";

import { useActionState } from "react";
import { saveName, type FormState } from "@/app/profile/actions";
import { buttonClass, inputClass, labelClass } from "@/app/components/styles";

export default function WelcomeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(saveName, {});

  return (
    <form action={action} className="mt-8 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2">
          <span className={labelClass}>First name</span>
          <input name="first_name" required autoComplete="given-name" className={inputClass} />
        </label>
        <label className="space-y-2">
          <span className={labelClass}>Last name</span>
          <input name="last_name" required autoComplete="family-name" className={inputClass} />
        </label>
      </div>
      {state.error && <p className="font-mono text-sm text-rouge">{state.error}</p>}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
