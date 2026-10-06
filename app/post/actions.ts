"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateCaptions } from "@/lib/gemini";
import { hoursAgo } from "@/lib/captions";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { createClient } from "@/lib/supabase/server";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const DAILY_POST_LIMIT = 10;
const CAPTIONS_PER_POST = 4;
const MAX_CAPTIONS_PER_PHOTO = 12;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Upload a photo, ask Gemini for captions, and save both.
export async function createPost(formData: FormData): Promise<{ error: string }> {
  const { supabase, user } = await requireUser();

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "Choose a photo first." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
    return { error: "Photos must be JPG, PNG, or WebP." };
  }
  if (photo.size > MAX_PHOTO_BYTES) return { error: "That photo is too large." };

  const rawNeighborhood = formData.get("neighborhood");
  const neighborhood = NEIGHBORHOODS.find((n) => n === rawNeighborhood) ?? null;
  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" && rawNote.trim() ? rawNote.trim().slice(0, 140) : null;

  // Protects the free Gemini quota from any one account.
  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", hoursAgo(24));
  if ((count ?? 0) >= DAILY_POST_LIMIT) {
    return { error: `You've posted ${DAILY_POST_LIMIT} photos today. Come back tomorrow!` };
  }

  const bytes = Buffer.from(await photo.arrayBuffer());
  let result;
  try {
    result = await generateCaptions({
      imageBase64: bytes.toString("base64"),
      mimeType: photo.type,
      neighborhood,
      note,
      count: CAPTIONS_PER_POST,
    });
  } catch (error) {
    return { error: (error as Error).message };
  }

  const path = `${user.id}/${Date.now()}.${photo.type.split("/")[1]}`;
  const { error: uploadError } = await supabase.storage
    .from("city-photos")
    .upload(path, bytes, { contentType: photo.type });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const imageUrl = supabase.storage.from("city-photos").getPublicUrl(path).data.publicUrl;
  const { data: saved, error: photoError } = await supabase
    .from("photos")
    .insert({ user_id: user.id, image_url: imageUrl, storage_path: path, neighborhood, note })
    .select("id")
    .single();
  if (photoError) return { error: photoError.message };

  const { error: captionError } = await supabase.from("captions").insert(
    result.captions.map((body) => ({
      photo_id: saved.id,
      user_id: user.id,
      body,
      prompt: result.prompt,
      model: result.model,
    }))
  );
  if (captionError) return { error: captionError.message };

  revalidatePath("/");
  redirect(`/p/${saved.id}`);
}

// Ask Gemini for a few fresh captions on one of your own photos.
export async function generateMoreCaptions(photoId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const { data: photo } = await supabase
    .from("photos")
    .select("id, user_id, image_url, neighborhood, note, captions (body)")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo || photo.user_id !== user.id) return { error: "You can only add captions to your own photos." };

  const existing = photo.captions.map((c) => c.body);
  const remaining = MAX_CAPTIONS_PER_PHOTO - existing.length;
  if (remaining <= 0) return { error: "This photo already has the maximum number of captions." };

  const image = await fetch(photo.image_url);
  if (!image.ok) return { error: "Couldn't load the photo. Try again." };
  const bytes = Buffer.from(await image.arrayBuffer());

  let result;
  try {
    result = await generateCaptions({
      imageBase64: bytes.toString("base64"),
      mimeType: image.headers.get("content-type") ?? "image/jpeg",
      neighborhood: photo.neighborhood,
      note: photo.note,
      count: Math.min(3, remaining),
      avoid: existing,
    });
  } catch (error) {
    return { error: (error as Error).message };
  }

  const { error } = await supabase.from("captions").insert(
    result.captions.map((body) => ({
      photo_id: photo.id,
      user_id: user.id,
      body,
      prompt: result.prompt,
      model: result.model,
    }))
  );
  if (error) return { error: error.message };

  revalidatePath(`/p/${photo.id}`);
  return {};
}

export async function deletePhoto(photoId: string) {
  const { supabase, user } = await requireUser();

  const { data: photo } = await supabase
    .from("photos")
    .select("id, user_id, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo || photo.user_id !== user.id) return;

  await supabase.from("photos").delete().eq("id", photo.id);
  await supabase.storage.from("city-photos").remove([photo.storage_path]);

  revalidatePath("/");
  redirect("/");
}

// Record the user's vote: 1 (up), -1 (down), or 0 to take it back.
export async function castVote(captionId: string, vote: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to vote." };
  if (![1, -1, 0].includes(vote)) return { error: "Invalid vote." };

  const { error } =
    vote === 0
      ? await supabase.from("caption_votes").delete().eq("caption_id", captionId).eq("user_id", user.id)
      : await supabase
          .from("caption_votes")
          .upsert({ caption_id: captionId, user_id: user.id, vote }, { onConflict: "caption_id,user_id" });

  return error ? { error: error.message } : {};
}
