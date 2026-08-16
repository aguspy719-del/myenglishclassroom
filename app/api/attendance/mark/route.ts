import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── Konfigurasi lokasi sekolah (server-side, tidak bisa di-bypass) ──
const SCHOOL_LOCATION = {
  lat: -7.434353,
  lng: 112.722242,
};
const MAX_DISTANCE_METERS = 150;

// Formula Haversine — hitung jarak antara dua koordinat GPS (meter)
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Verifikasi user sudah login
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Ambil profil — pastikan role student
    const { data: profile } = await supabase
      .from("users")
      .select("id, role, class_id")
      .eq("id", authUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    if (profile.role !== "student") {
      return NextResponse.json({ error: "Only students can mark attendance" }, { status: 403 });
    }
    if (!profile.class_id) {
      return NextResponse.json({ error: "You are not registered in any class" }, { status: 400 });
    }

    // 3. Parse body
    const body = await request.json();
    const { latitude, longitude, status } = body;

    // Validasi field
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "Koordinat GPS tidak valid" }, { status: 400 });
    }
    const validStatuses = ["present", "late", "absent", "excused"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
    }

    // 4. Validasi jarak di SERVER — tidak bisa di-bypass dari browser
    const distance = haversineDistance(latitude, longitude, SCHOOL_LOCATION.lat, SCHOOL_LOCATION.lng);
    const distanceRounded = Math.round(distance);

    if (distance > MAX_DISTANCE_METERS) {
      return NextResponse.json(
        {
          error: `Kamu terlalu jauh dari sekolah (${distanceRounded}m). Maksimal ${MAX_DISTANCE_METERS}m.`,
          distance: distanceRounded,
          maxDistance: MAX_DISTANCE_METERS,
          tooFar: true,
        },
        { status: 403 }
      );
    }

    // 5. Simpan atau update absensi hari ini
    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("student_id", profile.id)
      .eq("class_id", profile.class_id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("attendance")
        .update({ status, timestamp: new Date().toISOString() })
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabase.from("attendance").insert([{
        student_id: profile.id,
        class_id: profile.class_id,
        date: today,
        status,
        timestamp: new Date().toISOString(),
      }]);

      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      distance: distanceRounded,
      status,
    });
  } catch (err: any) {
    console.error("[Attendance Mark] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
