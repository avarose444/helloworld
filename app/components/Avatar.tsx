import Image from "next/image";
import type { Profile } from "@/lib/profile";

export default function Avatar({ profile, size }: { profile: Profile | null; size: number }) {
  const initials =
    [profile?.first_name, profile?.last_name]
      .map((name) => name?.trim()[0] ?? "")
      .join("")
      .toUpperCase() || "?";

  if (profile?.avatar_url) {
    return (
      <Image
        src={profile.avatar_url}
        alt="Your profile photo"
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover grayscale"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-bleu font-display text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}
