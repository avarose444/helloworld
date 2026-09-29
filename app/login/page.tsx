import { redirect } from "next/navigation";
import SignInButton from "@/app/components/SignInButton";
import { getCurrentUser } from "@/lib/profile";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { user } = await getCurrentUser();
  if (user) redirect("/screening-room");

  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-md border-2 border-black bg-white p-8 sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-rouge">Ciné-club</p>
        <h1 className="mt-3 font-display text-5xl uppercase leading-none">Sign in</h1>
        <p className="mt-4 font-mono text-zinc-700">
          Members get a seat in the Screening Room and a profile of their own.
        </p>
        {error && (
          <p className="mt-6 border-2 border-rouge p-3 font-mono text-sm text-rouge">
            Sign-in didn&apos;t work. Please try again.
          </p>
        )}
        <div className="mt-8">
          <SignInButton />
        </div>
      </div>
    </main>
  );
}
