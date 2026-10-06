"use client";

import { useState, useTransition } from "react";
import { createPost } from "./actions";
import { buttonClass, inputClass, labelClass } from "@/app/components/styles";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";

const MAX_DIMENSION = 1600;

// Shrinks the photo and re-encodes it as JPEG. This keeps uploads small and
// strips hidden metadata like GPS location from phone photos.
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image."))), "image/jpeg", 0.85)
  );
}

export default function PostForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a photo first.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        form.set("photo", new File([await prepareImage(file)], "photo.jpg", { type: "image/jpeg" }));
      } catch (err) {
        setError((err as Error).message);
        return;
      }
      const result = await createPost(form);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <label className="relative flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed border-black bg-white hover:bg-zinc-50">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={preview} alt="Your photo" className="h-full w-full object-cover" />
        ) : (
          <span className="p-6 text-center">
            <span className="block font-display text-3xl uppercase">Choose a photo</span>
            <span className="mt-2 block font-mono text-sm text-zinc-600">JPG, PNG, or WebP</span>
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            setFile(chosen);
            setPreview(chosen ? URL.createObjectURL(chosen) : null);
          }}
        />
      </label>

      <div className="space-y-6">
        <label className="block space-y-2">
          <span className={labelClass}>Where were you?</span>
          <select name="neighborhood" defaultValue="" className={inputClass}>
            <option value="">Somewhere in New York</option>
            {NEIGHBORHOODS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className={labelClass}>Context for the caption writer (optional)</span>
          <input
            name="note"
            maxLength={140}
            placeholder="first time seeing a rat this big"
            className={inputClass}
          />
        </label>
        <p className="font-mono text-sm text-zinc-600">
          Gemini will write four captions. Everyone gets to vote on which one wins.
        </p>
        {error && <p className="border-2 border-rouge p-3 font-mono text-sm text-rouge">{error}</p>}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Developing your film…" : "Caption it"}
        </button>
      </div>
    </form>
  );
}
