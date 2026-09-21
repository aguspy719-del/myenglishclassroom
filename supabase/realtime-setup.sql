-- ============================================================
-- English LMS — Realtime setup
-- Jalankan SELURUH file ini di Supabase Dashboard → SQL Editor
-- (project yang aktif dipakai aplikasi).
--
-- Tujuan: notifikasi lonceng siswa muncul TANPA refresh.
-- Aplikasi subscribe postgres_changes untuk tabel-tabel di bawah;
-- setelah project dibuat ulang, publication supabase_realtime kosong
-- sehingga event realtime tidak pernah terkirim (fallback polling
-- di components/layout/notifications.tsx hanya cadangan).
--
-- Catatan RLS: postgres_changes hanya mengirim baris yang lolos RLS
-- untuk user penerima (policy "Users can view own notifications"
-- sudah membatasi auth.uid() = user_id), jadi aman.
--
-- Aman dijalankan ulang (idempotent).
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;

-- Verifikasi (jalankan terpisah bila mau memastikan):
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
