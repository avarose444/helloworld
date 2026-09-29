import Link from "next/link";
import { getCurrentUser, needsName } from "@/lib/profile";
import Avatar from "./Avatar";

export default async function SiteHeader() {
  const { user, profile } = await getCurrentUser();

  return (
    <>
      <nav className="border-b border-white/10 bg-black px-6 sm:px-16">
        <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-300">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-display text-xl tracking-widest text-white">
              N<span className="text-rouge">·</span>V
            </Link>
            <Link href="/" className="hover:text-white">
              Films
            </Link>
            {user && (
              <Link href="/screening-room" className="hover:text-white">
                Screening Room
              </Link>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-4">
              <Link href="/profile" className="flex items-center gap-2 hover:text-white">
                <Avatar profile={profile} size={28} />
                <span className="hidden sm:inline">{profile?.first_name || "Profile"}</span>
              </Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="uppercase tracking-[0.2em] hover:text-rouge">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="bg-rouge px-3 py-1.5 font-bold text-white hover:bg-bleu">
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {user && needsName(profile) && (
        <div className="bg-rouge px-6 py-3 text-center font-mono text-sm text-white">
          We don&apos;t know your name yet.{" "}
          <Link href="/welcome" className="font-bold underline underline-offset-4">
            Complete your profile →
          </Link>
        </div>
      )}
    </>
  );
}
