import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check teacher role
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "teacher") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = formData.get("category") as string;

    if (!file || !category) {
      return NextResponse.json({ error: "Missing file or category" }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 50MB" }, { status: 400 });
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `ta-${category}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("materials")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      // Try avatars bucket as fallback
      const { error: fallbackError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (fallbackError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { error: dbError } = await supabase.from("teaching_aids").insert({
        category,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        uploaded_at: new Date().toISOString(),
      });

      if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
      return NextResponse.json({ success: true, url: urlData.publicUrl });
    }

    const { data: urlData } = supabase.storage.from("materials").getPublicUrl(fileName);

    const { error: dbError } = await supabase.from("teaching_aids").insert({
      category,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      uploaded_at: new Date().toISOString(),
    });

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
