import Link from "next/link";
import { connection } from "next/server";
import SubtitledPhoto from "@/app/components/SubtitledPhoto";
import TitleCard from "@/app/components/TitleCard";
import VoteButtons from "@/app/components/VoteButtons";
import { bestCaption, getMyVotes, getRecentPhotos, getTopCaptions } from "@/lib/captions";
import { getCurrentUser } from "@/lib/profile";

export default async function FeedPage() {
  await connection();

  const [{ user }, photos, [captionOfTheDay]] = await Promise.all([
    getCurrentUser(),
    getRecentPhotos(),
    getTopCaptions(24, 1),
  ]);

  const leaders = photos.map((photo) => ({ photo, caption: bestCaption(photo) }));
  const myVotes = await getMyVotes(
    user?.id,
    [...leaders.map((l) => l.caption?.id), captionOfTheDay?.id].filter((id): id is string => !!id)
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-black px-6 py-14 sm:px-16">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-sm uppercase tracking-[0.3em] text-zinc-400">
            New York, with subtitles
          </p>
          <h1 className="mt-4 font-display text-6xl uppercase leading-none tracking-wide sm:text-8xl">
            <TitleCard text="Caption the City" />
          </h1>
          <p className="mt-6 max-w-xl font-mono text-zinc-300">
            Post a photo from your weekend. AI writes it subtitles like a 1960s French film. Everyone votes on the best one.
          </p>
          {!user && (
            <div className="mt-8">
              <Link
                href="/login"
                className="inline-block bg-rouge px-6 py-3 font-display text-lg uppercase tracking-widest text-white hover:bg-bleu"
              >
                Sign in to post & vote
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="flex h-2">
        <div className="flex-1 bg-bleu" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-rouge" />
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:px-16">
        {captionOfTheDay?.photos && (
          <section className="mb-16 grid gap-8 border-2 border-black bg-white p-6 sm:grid-cols-[240px_1fr] sm:p-8">
            <Link href={`/p/${captionOfTheDay.photos.id}`}>
              <SubtitledPhoto
                src={captionOfTheDay.photos.image_url}
                alt={`Photo captioned: ${captionOfTheDay.body}`}
                sizes="240px"
              />
            </Link>
            <div className="flex flex-col justify-center">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-rouge">Caption of the day</p>
              <p className="mt-3 font-display text-3xl uppercase leading-tight sm:text-4xl">
                “{captionOfTheDay.body}”
              </p>
              <p className="mt-3 font-mono text-sm text-zinc-600">
                {captionOfTheDay.photos.neighborhood ?? "Somewhere in New York"}
              </p>
              <div className="mt-5 flex items-center gap-4">
                <VoteButtons
                  captionId={captionOfTheDay.id}
                  upvotes={captionOfTheDay.upvotes}
                  downvotes={captionOfTheDay.downvotes}
                  myVote={myVotes[captionOfTheDay.id] ?? 0}
                  signedIn={!!user}
                />
                <Link href="/top" className="font-mono text-xs uppercase tracking-[0.2em] underline underline-offset-4">
                  This week&apos;s top 10 →
                </Link>
              </div>
            </div>
          </section>
        )}

        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-4xl uppercase">Latest photos</h2>
          <Link href="/top" className="font-mono text-xs uppercase tracking-[0.2em] underline underline-offset-4">
            Top this week
          </Link>
        </div>

        {leaders.length === 0 ? (
          <p className="mt-8 font-mono text-zinc-600">No photos yet. Be the first to post one.</p>
        ) : (
          <ul className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {leaders.map(({ photo, caption }) => (
              <li key={photo.id}>
                <Link href={`/p/${photo.id}`} className="block">
                  <SubtitledPhoto
                    src={photo.image_url}
                    alt={caption ? `Photo captioned: ${caption.body}` : "Photo from the city"}
                    subtitle={caption?.body}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                </Link>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm text-zinc-700">{photo.neighborhood ?? "Somewhere in New York"}</p>
                    <Link
                      href={`/p/${photo.id}`}
                      className="font-mono text-xs uppercase tracking-[0.2em] underline underline-offset-4"
                    >
                      {photo.captions.length} captions →
                    </Link>
                  </div>
                  {caption && (
                    <VoteButtons
                      captionId={caption.id}
                      upvotes={caption.upvotes}
                      downvotes={caption.downvotes}
                      myVote={myVotes[caption.id] ?? 0}
                      signedIn={!!user}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
