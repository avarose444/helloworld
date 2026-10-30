"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateProfile, type FormState } from "./actions";
import { buttonClass, inputClass, labelClass } from "@/app/components/styles";
import type { Profile } from "@/lib/profile";

export default function ProfileForm({ profile }: { profile: Profile | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, {});
  const [preview, setPreview] = useState<string | null>(profile?.avatar_url ?? null);

  return (
    <form action={action} className="grid gap-10 sm:grid-cols-[200px_1fr]">
      <div className="space-y-3">
        <div className="relative aspect-square w-full max-w-[200px] overflow-hidden border-2 border-black bg-black">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={preview} alt="Profile photo preview" className="h-full w-full object-cover grayscale" />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-2xl uppercase text-white">
              No photo
            </div>
          )}
        </div>
        <label className="block cursor-pointer border-2 border-black px-3 py-2 text-center font-mono text-xs font-bold uppercase tracking-[0.2em] hover:bg-black hover:text-white">
          Choose photo
          <input
            type="file"
            name="photo"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setPreview(URL.createObjectURL(file));
            }}
          />
        </label>
        <p className="font-mono text-xs text-zinc-600">JPG, PNG, or WebP, up to 3 MB.</p>
      </div>

      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2">
            <span className={labelClass}>First name</span>
            <input name="first_name" defaultValue={profile?.first_name ?? ""} className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className={labelClass}>Last name</span>
            <input name="last_name" defaultValue={profile?.last_name ?? ""} className={inputClass} />
          </label>
        </div>
        <div className="space-y-2">
          <span className={labelClass}>Favorite film</span>
          <p className="font-mono text-sm">
            {profile?.favorite_film ?? "None yet"} ·{" "}
            <Link href="/films" className="underline underline-offset-4">
              {profile?.favorite_film ? "Change" : "Pick one"} on the Films page ☆
            </Link>
          </p>
        </div>
        <label className="block space-y-2">
          <span className={labelClass}>Email</span>
          <input value={profile?.email ?? ""} disabled className={`${inputClass} bg-zinc-100 text-zinc-500`} />
        </label>
        {state.error && <p className="font-mono text-sm text-rouge">{state.error}</p>}
        {state.success && <p className="font-mono text-sm text-bleu">{state.success}</p>}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
