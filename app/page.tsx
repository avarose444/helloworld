import { connection } from "next/server";
import { supabase } from "@/lib/supabase";

type Movie = {
  id: number;
  title: string;
  director: string;
  year: number;
};

export default async function Home() {
  // Render at request time so new rows in Supabase show up without a redeploy.
  await connection();

  const { data: movies, error } = await supabase
    .from("movies")
    .select("id, title, director, year")
    .order("year", { ascending: true });

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-3xl py-16 px-6 sm:px-16">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Favorite Movies
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Rows fetched from the <code className="font-mono">movies</code> table in Supabase.
        </p>

        {error ? (
          <p className="mt-8 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            Could not load movies: {error.message}
          </p>
        ) : !movies || movies.length === 0 ? (
          <p className="mt-8 text-zinc-600 dark:text-zinc-400">No movies found.</p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {(movies as Movie[]).map((movie) => (
              <li
                key={movie.id}
                className="rounded-xl border border-black/[.08] bg-white p-5 shadow-sm dark:border-white/[.145] dark:bg-zinc-900"
              >
                <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
                  {movie.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {movie.director}
                </p>
                <p className="mt-3 text-sm font-medium text-zinc-500">{movie.year}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
