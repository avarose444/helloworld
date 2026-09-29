import { redirect } from "next/navigation";
import { getCurrentUser, needsName } from "@/lib/profile";
import WelcomeForm from "./WelcomeForm";

export default async function WelcomePage() {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login");
  if (!needsName(profile)) redirect("/screening-room");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-xl border-2 border-black bg-white p-8 sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-rouge">Bienvenue</p>
        <h1 className="mt-3 font-display text-5xl uppercase leading-none">Qui êtes-vous?</h1>
        <p className="mt-4 font-mono text-zinc-700">
          Before the lights go down, tell us who you are.
        </p>
        <WelcomeForm />
      </div>
    </main>
  );
}
