"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setFavoriteFilm } from "./actions";

export default function FavoriteButton({
  movieId,
  title,
  isFavorite,
  signedIn,
}: {
  movieId: number;
  title: string;
  isFavorite: boolean;
  signedIn: boolean;
}) {
  const [pending, start] = useTransition();
  const [starred, setStarred] = useOptimistic(isFavorite);

  const className = `flex h-11 w-11 items-center justify-center border-2 border-black text-2xl leading-none transition-colors ${
    starred ? "bg-rouge text-white" : "bg-white text-black hover:bg-black hover:text-white"
  }`;

  if (!signedIn) {
    return (
      <Link href="/login" aria-label={`Sign in to make ${title} your favorite`} title="Sign in to pick a favorite" className={className}>
        ☆
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={starred}
      aria-label={starred ? `Remove ${title} as your favorite film` : `Make ${title} your favorite film`}
      title={starred ? "Your favorite. Click to remove." : "Make this your favorite"}
      className={className}
      onClick={() =>
        start(async () => {
          setStarred(!starred);
          await setFavoriteFilm(starred ? null : movieId);
        })
      }
    >
      {starred ? "★" : "☆"}
    </button>
  );
}
