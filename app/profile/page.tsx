import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/profile";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:px-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-rouge">Settings</p>
      <h1 className="mt-3 font-display text-5xl uppercase leading-none sm:text-6xl">Edit profile</h1>
      <div className="mt-10 border-2 border-black bg-white p-6 sm:p-10">
        <ProfileForm profile={profile} />
      </div>
    </main>
  );
}
