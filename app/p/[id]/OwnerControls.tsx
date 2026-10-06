"use client";

import { useState, useTransition } from "react";
import { deletePhoto, generateMoreCaptions } from "@/app/post/actions";

export default function OwnerControls({ photoId, canGenerate }: { photoId: string; canGenerate: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const button =
    "border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.2em] transition-colors disabled:opacity-50";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {canGenerate && (
          <button
            type="button"
            disabled={generating}
            onClick={() =>
              startGenerating(async () => {
                setError(null);
                const result = await generateMoreCaptions(photoId);
                if (result.error) setError(result.error);
              })
            }
            className={`${button} bg-black text-white hover:bg-bleu hover:border-bleu`}
          >
            {generating ? "Writing…" : "Generate 3 more captions"}
          </button>
        )}
        <button
          type="button"
          disabled={deleting}
          onClick={() => {
            if (confirm("Delete this photo and all of its captions and votes?")) {
              startDeleting(() => deletePhoto(photoId));
            }
          }}
          className={`${button} bg-white hover:bg-rouge hover:border-rouge hover:text-white`}
        >
          {deleting ? "Deleting…" : "Delete post"}
        </button>
      </div>
      {error && <p className="font-mono text-sm text-rouge">{error}</p>}
    </div>
  );
}
