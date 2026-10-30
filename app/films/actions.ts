"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Star a film as your favorite, or pass null to un-star it.
export async function setFavoriteFilm(movieId: number | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let title: string | null = null;
  if (movieId !== null) {
    const { data: movie } = await supabase.from("movies").select("title").eq("id", movieId).maybeSingle();
    if (!movie) return { error: "That film isn't in the list." };
    title = movie.title;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ favorite_film: title, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/films");
  revalidatePath("/me");
  return {};
}
