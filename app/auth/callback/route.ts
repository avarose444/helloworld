import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google sends users back here (via Supabase) with a one-time code.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();

        // First-time users missing a name are prompted to add one.
        const hasName = profile?.first_name?.trim() && profile?.last_name?.trim();
        return NextResponse.redirect(new URL(hasName ? "/screening-room" : "/welcome", origin));
      }
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
