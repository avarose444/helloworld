import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  favorite_film: string | null;
  avatar_url: string | null;
  created_at: string;
};

// Deduplicated per request, so the header and page can both call it.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, favorite_film, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { user, profile };
});

export function needsName(profile: Profile | null) {
  return !profile?.first_name?.trim() || !profile?.last_name?.trim();
}
