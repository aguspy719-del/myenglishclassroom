import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://wuwqmcaknvzrdsdpqkse.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1d3FtY2FrbnZ6cmRzZHBxa3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTI1NjgsImV4cCI6MjA5NDA4ODU2OH0.UfqltdpCHdMuqumwa6vAsTLkYnxyHvj5wXQgV6i4LMM";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
