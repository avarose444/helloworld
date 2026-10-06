"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { castVote } from "@/app/post/actions";

type Props = {
  captionId: string;
  upvotes: number;
  downvotes: number;
  myVote: 1 | -1 | 0;
  signedIn: boolean;
};

export default function VoteButtons({ captionId, upvotes, downvotes, myVote, signedIn }: Props) {
  const router = useRouter();
  const [vote, setVote] = useState(myVote);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Show the server's counts adjusted by any change to this user's vote.
  const score = upvotes - downvotes - myVote + vote;

  function choose(value: 1 | -1) {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    const previous = vote;
    const next = vote === value ? 0 : value;
    setVote(next);
    setError(null);
    startTransition(async () => {
      const result = await castVote(captionId, next);
      if (result.error) {
        setVote(previous);
        setError(result.error);
      }
    });
  }

  const base = "flex h-9 w-9 items-center justify-center border-2 border-black font-display text-lg transition-colors";

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2" title={signedIn ? undefined : "Sign in to vote"}>
        <button
          type="button"
          aria-label="Upvote"
          aria-pressed={vote === 1}
          onClick={() => choose(1)}
          className={`${base} ${vote === 1 ? "bg-bleu text-white border-bleu" : "bg-white hover:bg-bleu hover:text-white hover:border-bleu"}`}
        >
          ▲
        </button>
        <span className="w-8 text-center font-display text-xl tabular-nums">{score}</span>
        <button
          type="button"
          aria-label="Downvote"
          aria-pressed={vote === -1}
          onClick={() => choose(-1)}
          className={`${base} ${vote === -1 ? "bg-rouge text-white border-rouge" : "bg-white hover:bg-rouge hover:text-white hover:border-rouge"}`}
        >
          ▼
        </button>
      </div>
      {error && <p className="font-mono text-xs text-rouge">{error}</p>}
    </div>
  );
}
