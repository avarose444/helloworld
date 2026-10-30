"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; success?: string };

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Used by /welcome: first and last name are required here.
export async function saveName(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const firstName = text(formData, "first_name");
  const lastName = text(formData, "last_name");

  if (!firstName || !lastName) {
    return { error: "Please enter both your first and last name." };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      updated_at: new Date().toISOString(),
    });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/me");
}

// Used by /profile: names, favorite film, and an optional new photo.
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();

  const updates: Record<string, string | null> = {
    id: user.id,
    email: user.email ?? null,
    first_name: text(formData, "first_name"),
    last_name: text(formData, "last_name"),
    updated_at: new Date().toISOString(),
  };

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) {
      return { error: "Your photo must be an image file." };
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return { error: "Your photo must be 3 MB or smaller." };
    }

    // The image itself lives in Supabase Storage; the table only stores its URL.
    const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, photo, { contentType: photo.type });

    if (uploadError) return { error: `Photo upload failed: ${uploadError.message}` };

    updates.avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("profiles").upsert(updates);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "Profile saved." };
}
