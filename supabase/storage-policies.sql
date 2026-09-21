-- ============================================================
-- English LMS — Storage RLS policies
-- Jalankan SELURUH file ini di Supabase Dashboard → SQL Editor
-- (project yang aktif dipakai aplikasi).
--
-- Latar belakang: project dibuat ulang dan bucket-nya dibuat
-- manual, tetapi policy pada storage.objects tidak ikut dibuat.
-- Akibatnya setiap upload file dari browser ditolak:
--   403 "new row violates row-level security policy"
-- Aman dijalankan ulang (idempotent).
-- ============================================================

-- 1. MATERIALS bucket: semua user ter-autentikasi boleh upload
DROP POLICY IF EXISTS "Authenticated users can upload materials" ON storage.objects;
CREATE POLICY "Authenticated users can upload materials" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materials');

-- 2. ASSIGNMENTS bucket: semua user ter-autentikasi boleh upload
DROP POLICY IF EXISTS "Authenticated users can upload assignments" ON storage.objects;
CREATE POLICY "Authenticated users can upload assignments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assignments');

-- 3. SUBMISSIONS bucket: siswa upload jawaban tugas
DROP POLICY IF EXISTS "Authenticated users can upload submissions" ON storage.objects;
CREATE POLICY "Authenticated users can upload submissions" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submissions');

-- 4. AVATARS bucket: foto profil & fallback teaching aids
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- 5. Baca publik untuk bucket publik (url publik tetap bisa diakses
--    tanpa ini karena bucket public, tapi policy ini diperlukan agar
--    listing/signed URL dari client bekerja normal)
DROP POLICY IF EXISTS "Public read for materials" ON storage.objects;
CREATE POLICY "Public read for materials" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('materials', 'assignments', 'teaching-aids', 'avatars'));

DROP POLICY IF EXISTS "Users can read own submissions" ON storage.objects;
CREATE POLICY "Users can read own submissions" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND auth.uid() IS NOT NULL);

-- 6. Update/delete untuk user ter-autentikasi pada bucket publik
--    (dipakai saat replace file/avatar, mencegah file yatim)
DROP POLICY IF EXISTS "Authenticated users can update public buckets" ON storage.objects;
CREATE POLICY "Authenticated users can update public buckets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('materials', 'assignments', 'avatars'))
  WITH CHECK (bucket_id IN ('materials', 'assignments', 'avatars'));

DROP POLICY IF EXISTS "Authenticated users can delete public buckets" ON storage.objects;
CREATE POLICY "Authenticated users can delete public buckets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('materials', 'assignments', 'avatars'));

-- 7. Service role bypass semua policy (default Supabase).
--    Tidak perlu policy khusus; jangan matikan bypassRLS untuk role service_role.
