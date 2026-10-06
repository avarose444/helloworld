import { createClient } from "@/lib/supabase/server";

export type Caption = {
  id: string;
  photo_id: string;
  body: string;
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: string;
};

export type Photo = {
  id: string;
  user_id: string;
  image_url: string;
  neighborhood: string | null;
  note: string | null;
  created_at: string;
  captions: Caption[];
};

export type RankedCaption = Caption & {
  photos: Pick<Photo, "id" | "image_url" | "neighborhood"> | null;
};

export const CAPTION_FIELDS = "id, photo_id, body, upvotes, downvotes, score, created_at";
const PHOTO_FIELDS = `id, user_id, image_url, neighborhood, note, created_at, captions (${CAPTION_FIELDS})`;

export function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export function bestCaption(photo: Photo) {
  return [...photo.captions].sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at))[0];
}

export async function getRecentPhotos(limit = 30) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("photos")
    .select(PHOTO_FIELDS)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Photo[];
}

export async function getPhoto(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("photos").select(PHOTO_FIELDS).eq("id", id).maybeSingle();
  return data as Photo | null;
}

export async function getTopCaptions(sinceHours: number, limit: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("captions")
    .select(`${CAPTION_FIELDS}, photos (id, image_url, neighborhood)`)
    .gte("created_at", hoursAgo(sinceHours))
    .gt("score", 0)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as RankedCaption[];
}

// The signed-in user's votes for these captions, as { captionId: 1 | -1 }.
export async function getMyVotes(userId: string | undefined, captionIds: string[]) {
  if (!userId || captionIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("caption_votes")
    .select("caption_id, vote")
    .eq("user_id", userId)
    .in("caption_id", captionIds);
  return Object.fromEntries((data ?? []).map((v) => [v.caption_id, v.vote])) as Record<string, 1 | -1>;
}
