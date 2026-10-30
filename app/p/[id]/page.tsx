import Link from "next/link";
import { notFound } from "next/navigation";
import SubtitledPhoto from "@/app/components/SubtitledPhoto";
import VoteButtons from "@/app/components/VoteButtons";
import { bestCaption, getMyVotes, getPhoto } from "@/lib/captions";
import { getCurrentUser } from "@/lib/profile";
import OwnerControls from "./OwnerControls";

export default async function PhotoPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const [{ user }, photo] = await Promise.all([getCurrentUser(), getPhoto(id)]);
  if (!photo) notFound();

  const captions = [...photo.captions].sort(
    (a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at)
  );
  const myVotes = await getMyVotes(user?.id, captions.map((c) => c.id));
  const isOwner = user?.id === photo.user_id;
  const leader = bestCaption(photo);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:px-16">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] underline underline-offset-4">
        ← Back to the feed
      </Link>

      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-3">
          <SubtitledPhoto
            src={photo.image_url}
            alt={leader ? `Photo captioned: ${leader.body}` : "Photo from the city"}
            subtitle={leader?.body}
            sizes="(min-width: 768px) 40vw, 100vw"
            priority
          />
          <p className="font-mono text-sm text-zinc-600">
            {photo.neighborhood ?? "Somewhere in New York"}
            {photo.note && <> · “{photo.note}”</>}
          </p>
        </div>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-rouge">Captions</p>
          <h1 className="mt-2 font-display text-4xl uppercase leading-none">Vote for the best caption</h1>
          {!user && (
            <p className="mt-4 border-2 border-bleu p-3 font-mono text-sm text-bleu">
              <Link href="/login" className="font-bold underline underline-offset-4">
                Sign in
              </Link>{" "}
              to vote.
            </p>
          )}

          <ol className="mt-6 divide-y-2 divide-black border-y-2 border-black">
            {captions.map((caption, index) => (
              <li key={caption.id} className="flex items-center gap-4 py-4">
                <span className="w-6 shrink-0 font-display text-xl text-zinc-400">{index + 1}</span>
                <p className="flex-1 font-mono">{caption.body}</p>
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

          {isOwner && (
            <div className="mt-8">
              <OwnerControls photoId={photo.id} canGenerate={captions.length < 12} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
