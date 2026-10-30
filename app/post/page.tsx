import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/profile";
import PostForm from "./PostForm";

export default async function PostPage() {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:px-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-rouge">Nouveau</p>
      <h1 className="mt-3 font-display text-5xl uppercase leading-none sm:text-6xl">Post a photo</h1>
      <p className="mt-4 max-w-xl font-mono text-zinc-700">
        Upload a photo from your weekend in the city. The AI writes the subtitles; the crowd picks the best one.
      </p>
      <div className="mt-10">
        <PostForm />
      </div>
    </main>
  );
}
