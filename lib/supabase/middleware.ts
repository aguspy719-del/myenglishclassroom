import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://wuwqmcaknvzrdsdpqkse.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1d3FtY2FrbnZ6cmRzZHBxa3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTI1NjgsImV4cCI6MjA5NDA4ODU2OH0.UfqltdpCHdMuqumwa6vAsTLkYnxyHvj5wXQgV6i4LMM";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options } as any);
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options } as any);
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options } as any);
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: "", ...options } as any);
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const protectedPaths = ["/dashboard", "/classes", "/materials", "/assignments", "/attendance", "/grades", "/quiz", "/profile"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
