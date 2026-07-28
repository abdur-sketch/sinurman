# Migrasi SINURMAN ke Firebase

Target produksi:

- Firebase App Hosting untuk aplikasi Next.js.
- Firebase Authentication untuk Admin, Ustadz, Musyrif, Kepala Asrama, dan Wali Santri.
- Cloud Firestore untuk data operasional.
- Cloud Storage for Firebase untuk dokumen PPDB dan berkas santri.
- Firebase Local Emulator Suite untuk pengembangan.

## Status

Project `sinurman-2026`, Web App SINURMAN, dan Firestore Standard region Jakarta
telah dibuat. Backend App Hosting `sinurman` memakai Node.js 22 di region
Singapore dan sudah tayang di
`https://sinurman--sinurman-2026.asia-southeast1.hosted.app`. SDK Admin/Client,
aturan Firestore, emulator, pemeriksaan konfigurasi, build Next.js, serta
health check produksi telah disiapkan. Versi ChatGPT Sites tetap aktif sebagai
cadangan selama migrasi data.

Paket Blaze dan satu budget alert sudah aktif. Authentication email/password,
Firestore, bucket Storage region Jakarta, serta aturan keamanan Firestore dan
Storage sudah aktif. Akses dashboard Firebase memakai sesi HttpOnly; pemilik
masuk dengan `baikganteng88@gmail.com`, pegawai hanya dapat masuk jika email dan
perannya sudah terdaftar, Portal Wali tetap memakai nomor HP/PIN, dan PPDB tetap
publik.

Adapter kompatibilitas memindahkan binding data aplikasi ke Firestore dan
binding dokumen PPDB ke Cloud Storage tanpa mengubah versi ChatGPT/Vinext.
Health check produksi saat ini menyatakan Authentication, Firestore, dan Storage
siap. Build Firebase, build Vinext, dan 30 test regresi lulus.

Service account App Hosting sudah mendapat izin IAM
`roles/storage.objectAdmin` setelah persetujuan eksplisit pemilik, sehingga
backend dapat membaca, mengunggah, dan menghapus objek dokumen PPDB. Data lama
dari D1/R2 belum dapat diimpor karena ekspor sumber tidak tersedia di workspace.

## Data yang harus dimigrasikan

Migrasi harus mempertahankan ID dan hubungan seluruh tabel: pengguna, santri, pegawai, kelas, riwayat kenaikan, tahfidz, mutabaah, kesehatan, transaksi, rapor, absensi, izin, jadwal, kamar, PPDB, dokumen, konseling, tagihan, portal wali, SINURPAY, kantin, notifikasi, dan audit.

Cutover Firebase baru boleh dilakukan setelah:

1. Atur kata sandi Admin melalui email Firebase lalu uji dashboard dengan login normal.
2. Ekspor data D1/R2 lama, impor, dan verifikasi jumlah serta relasinya.
3. Uji unggah/unduh dokumen PPDB dan seluruh transaksi penting di produksi.
4. Lakukan cutover utama setelah hasil uji pengguna diterima.
