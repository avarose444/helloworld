import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, needsName } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/app/components/Avatar";

type Movie = { id: number; title: string; director: string; year: number; image_url: string | null };

// A different feature each day, chosen from the movies table.
function pickTonightsFeature(movies: Movie[]) {
  const dayNumber = Math.floor(Date.now() / 86_400_000);
  return movies[dayNumber % movies.length];
}

export default async function ScreeningRoomPage() {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login");
  if (needsName(profile)) redirect("/welcome");

  const supabase = await createClient();
  const { data: movies } = await supabase
    .from("movies")
    .select("id, title, director, year, image_url")
    .order("id");

  const feature = movies?.length ? pickTonightsFeature(movies as Movie[]) : null;

  const memberSince = new Date(profile!.created_at).toLocaleDateString("fr-FR", {
    dateStyle: "long",
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:px-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-rouge">Members only</p>
      <h1 className="mt-3 font-display text-5xl uppercase leading-none sm:text-6xl">
        Bonsoir, {profile!.first_name}.
      </h1>

      <section className="mt-10 flex flex-col border-2 border-black bg-white sm:flex-row">
        <div className="flex flex-1 items-center gap-5 p-6 sm:p-8">
          <Avatar profile={profile} size={72} />
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">Admit one</p>
            <p className="font-display text-3xl uppercase leading-tight">
              {profile!.first_name} {profile!.last_name}
            </p>
            <p className="mt-1 font-mono text-sm text-zinc-600">Membre depuis le {memberSince}</p>
          </div>
        </div>
        <div className="border-t-2 border-dashed border-black p-6 sm:border-l-2 sm:border-t-0 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">Favorite film</p>
          <p className="mt-1 font-display text-2xl uppercase text-bleu">
            {profile!.favorite_film ?? "—"}
          </p>
          <Link href="/profile" className="mt-2 inline-block font-mono text-xs underline underline-offset-4">
            Edit profile
          </Link>
        </div>
      </section>

      {feature && (
        <section className="mt-12 grid gap-8 bg-black p-6 text-white sm:grid-cols-[220px_1fr] sm:p-10">
          <div className="relative aspect-[2/3] overflow-hidden border-2 border-white">
            {feature.image_url && (
              <Image
                src={feature.image_url}
                alt={`Poster for ${feature.title}`}
                fill
                sizes="220px"
                className="object-cover grayscale contrast-125"
              />
            )}
          </div>
          <div className="flex flex-col justify-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-rouge">Ce soir · Tonight</p>
            <h2 className="mt-3 font-display text-5xl uppercase leading-none">{feature.title}</h2>
            <p className="mt-4 font-mono text-zinc-300">
              réal. {feature.director}, {feature.year}
            </p>
            <p className="mt-6 font-mono text-sm text-zinc-400">
              Tonight&apos;s feature changes every day. Take your seat.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
