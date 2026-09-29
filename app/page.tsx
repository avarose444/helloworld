import Image from "next/image";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Movie = {
  id: number;
  title: string;
  director: string;
  year: number;
  image_url: string | null;
};

// Godard-style title card: letters cycle through rouge, blanc, bleu.
const TITLE_COLORS = ["text-rouge", "text-white", "text-bleu"];

function TitleCard({ text }: { text: string }) {
  let i = 0;
  return (
    <span aria-label={text}>
      {text.split("").map((char, index) =>
        char === " " ? (
          <span key={index}> </span>
        ) : (
          <span key={index} aria-hidden className={TITLE_COLORS[i++ % TITLE_COLORS.length]}>
            {char}
          </span>
        )
      )}
    </span>
  );
}

export default async function Home() {
  // Render at request time so new rows in Supabase show up without a redeploy.
  await connection();

  const supabase = await createClient();
  const { data: movies, error } = await supabase
    .from("movies")
    .select("id, title, director, year, image_url")
    .order("year", { ascending: true });

  const fetchedAt = new Date().toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "long",
    timeStyle: "medium",
  });

  return (
    <div className="flex flex-col flex-1">
      <header className="bg-black px-6 py-14 sm:px-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-sm uppercase tracking-[0.3em] text-zinc-400">
            Un film de Supabase
          </p>
          <h1 className="mt-4 font-display text-6xl uppercase leading-none tracking-wide sm:text-8xl">
            <TitleCard text="La Nouvelle Vague" />
          </h1>
          <p className="mt-6 max-w-xl font-mono text-zinc-300">
            A few favorite films, pulled live from the{" "}
            <span className="text-white underline decoration-rouge decoration-2 underline-offset-4">
              movies
            </span>{" "}
            table.
          </p>
        </div>
      </header>

      <div className="flex h-2">
        <div className="flex-1 bg-bleu" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-rouge" />
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:px-16">
        {error ? (
          <p className="border-2 border-rouge p-4 font-mono text-rouge">
            Could not load movies: {error.message}
          </p>
        ) : !movies || movies.length === 0 ? (
          <p className="font-mono">No movies found.</p>
        ) : (
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {(movies as Movie[]).map((movie, index) => (
              <li key={movie.id} className="group">
                <div className="relative aspect-[2/3] overflow-hidden border-2 border-black bg-black">
                  {movie.image_url ? (
                    <Image
                      src={movie.image_url}
                      alt={`Poster for ${movie.title}`}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover grayscale contrast-125 transition duration-500 group-hover:scale-105 group-hover:grayscale-0"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-6 text-center font-display text-4xl uppercase text-white">
                      {movie.title}
                    </div>
                  )}
                  <span className="absolute left-0 top-0 bg-rouge px-3 py-1 font-mono text-sm font-bold text-white">
                    N° {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl uppercase leading-tight tracking-wide">
                      {movie.title}
                    </h2>
                    <p className="mt-1 font-mono text-sm text-zinc-700">
                      réal. {movie.director}
                    </p>
                  </div>
                  <p className="font-display text-2xl text-bleu">{movie.year}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="bg-black px-6 py-8 text-center font-mono text-sm text-zinc-400 sm:px-16">
        <span className="font-display text-2xl tracking-widest text-white">FIN</span>
        <p className="mt-2">Chargé le {fetchedAt}</p>
      </footer>
    </div>
  );
}
