import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import VoteButtons from "@/app/components/VoteButtons";
import { getMyVotes, getTopCaptions } from "@/lib/captions";
import { getCurrentUser } from "@/lib/profile";

export default async function TopPage() {
  await connection();
  const [{ user }, captions] = await Promise.all([getCurrentUser(), getTopCaptions(24 * 7, 10)]);
  const myVotes = await getMyVotes(user?.id, captions.map((c) => c.id));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:px-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-rouge">Palmarès</p>
      <h1 className="mt-3 font-display text-5xl uppercase leading-none sm:text-6xl">Top 10 this week</h1>
      <p className="mt-4 font-mono text-zinc-700">The highest-voted captions from the last seven days.</p>

      {captions.length === 0 ? (
        <p className="mt-10 font-mono text-zinc-600">No votes yet this week. Go pick some winners.</p>
      ) : (
        <ol className="mt-10 divide-y-2 divide-black border-y-2 border-black">
          {captions.map((caption, index) => (
            <li key={caption.id} className="flex items-center gap-4 py-4 sm:gap-6">
              <span className={`w-10 shrink-0 font-display text-4xl ${index < 3 ? "text-rouge" : "text-zinc-400"}`}>
                {index + 1}
              </span>
              {caption.photos && (
                <Link href={`/p/${caption.photos.id}`} className="relative h-20 w-16 shrink-0 overflow-hidden border-2 border-black">
                  <Image src={caption.photos.image_url} alt="" fill sizes="64px" className="object-cover" />
                </Link>
              )}
              <div className="flex-1">
                <p className="font-mono sm:text-lg">{caption.body}</p>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {caption.photos?.neighborhood ?? "Somewhere in New York"}
                </p>
              </div>
              <VoteButtons
                captionId={caption.id}
                upvotes={caption.upvotes}
                downvotes={caption.downvotes}
                myVote={myVotes[caption.id] ?? 0}
                signedIn={!!user}
              />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
