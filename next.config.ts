import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // The profile page used to be called the Screening Room.
  async redirects() {
    return [{ source: "/screening-room", destination: "/me", permanent: true }];
  },
  images: {
    remotePatterns: [
      new URL("https://upload.wikimedia.org/**"),
      // Profile photos uploaded to the public "avatars" storage bucket.
      ...(supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/**`)] : []),
    ],
  },
  experimental: {
    serverActions: {
      // Leaves room for 3 MB profile photos plus multipart overhead.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
