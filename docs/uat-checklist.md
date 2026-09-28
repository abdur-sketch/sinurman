# SINURMAN — Checklist UAT Produksi

Gunakan akun dan data uji yang sudah disetujui. Jangan memakai data santri nyata untuk skenario penghapusan, restore, atau pembayaran. Kolom **Aktual** dan **Status** diisi setelah pengujian manual.

| ID | Peran | Fitur / langkah uji | Hasil yang diharapkan | Aktual | Status | Catatan |
|---|---|---|---|---|---|---|
| AUTH-001 | Admin | Login dengan nomor HP dan PIN valid | Masuk dashboard sesuai peran | — | NOT TESTED | |
| AUTH-002 | Admin | PIN salah berulang | Ditolak dan rate-limit/lock diterapkan | — | NOT TESTED | |
| AUTH-003 | Admin | Logout lalu buka halaman terlindungi | Dialihkan ke login | — | NOT TESTED | |
| AUTH-004 | Admin | Aktifkan MFA lalu login ulang | MFA diminta untuk mutasi admin | — | NOT TESTED | |
| AUTH-005 | Admin | Reset sandi pengguna | Sesi lama dicabut dan akun dapat masuk dengan sandi baru | — | NOT TESTED | |
| AUTH-006 | Admin | Ubah peran pengguna | Sesi lama berakhir dan menu mengikuti peran baru | — | NOT TESTED | |
| AUTH-007 | Wali Santri | Hubungkan dengan nomor HP santri | Hanya anak yang terhubung yang terlihat | — | NOT TESTED | |
| SANTRI-001 | Admin | Tambah santri dengan kelas valid | Data tersimpan dan muncul di daftar | — | NOT TESTED | |
| SANTRI-002 | Admin | Tambah NIS duplikat | Ditolak dengan pesan yang jelas | — | NOT TESTED | |
| SANTRI-003 | Admin | Buka kartu/detail santri | Data pribadi lengkap tampil; email wali tidak digunakan | — | NOT TESTED | |
| SANTRI-004 | Admin | Ubah status santri | Dashboard dan portal ikut diperbarui | — | NOT TESTED | |
| IMPORT-001 | Admin | Impor Excel template valid | Baris valid tersimpan dan jumlah dilaporkan | — | NOT TESTED | |
| IMPORT-002 | Admin | Impor dengan kolom wajib hilang | Ditolak tanpa perubahan parsial | — | NOT TESTED | |
| IMPORT-003 | Admin | Impor dengan kelas tidak ada | Ditolak atau dilaporkan sebagai referensi tidak valid | — | NOT TESTED | |
| QR-001 | Musyrif | Scan QR presensi valid | Kehadiran tercatat sekali | — | NOT TESTED | |
| QR-002 | Musyrif | Scan token QR kedaluwarsa/duplikat | Ditolak dan tidak membuat catatan kedua | — | NOT TESTED | |
| QR-003 | Admin | Lihat antrean offline lalu sinkronkan | Antrean dikirim sekali setelah koneksi pulih | — | NOT TESTED | |
| ACADEMIC-001 | Ustadz | Input nilai akademik | Nilai akhir/predikat dihitung benar | — | NOT TESTED | |
| ACADEMIC-002 | Ustadz | Input setoran tahfidz | Catatan tampil pada rapor dan portal wali setelah publikasi | — | NOT TESTED | |
| ACADEMIC-003 | Admin | Kunci periode akademik | Perubahan periode terkunci ditolak | — | NOT TESTED | |
| FINANCE-001 | Admin | Buat tagihan | Nomor invoice dan jatuh tempo unik | — | NOT TESTED | |
| FINANCE-002 | Wali Santri | Buat payment link sandbox | Link provider terbentuk tanpa transaksi produksi | — | NOT TESTED | |
| FINANCE-003 | Sistem | Kirim webhook valid | Status tagihan berubah sekali dan diaudit | — | NOT TESTED | |
| FINANCE-004 | Sistem | Kirim webhook signature salah | Ditolak tanpa perubahan data | — | NOT TESTED | |
| FINANCE-005 | Admin | Rekonsiliasi pembayaran | Duplikasi reference tidak menggandakan saldo | — | NOT TESTED | |
| PUSH-001 | Admin | Minta izin notifikasi dari perangkat | Token perangkat tersimpan setelah persetujuan | — | NOT TESTED | |
| PUSH-002 | Admin | Kirim notifikasi uji | Notifikasi muncul atau status kegagalan tercatat | — | NOT TESTED | |
| BACKUP-001 | Admin | Buat backup server | JSON berisi manifest, checksum, dan audit log | — | NOT TESTED | |
| BACKUP-002 | Scheduler | Jalankan endpoint backup dengan secret valid | Backup otomatis dibuat; secret salah ditolak | — | NOT TESTED | |
| RESTORE-001 | Admin | Validasi backup, lalu konfirmasi `PULIHKAN` | Dry-run memberi ringkasan; restore hanya setelah konfirmasi kedua | — | NOT TESTED | Uji di lingkungan aman |
| RBAC-001 | Admin | Buka semua modul | Modul Admin tersedia | — | NOT TESTED | |
| RBAC-002 | Ustadz | Buka Tahfidz/Akademik | Hanya modul penugasan yang tersedia | — | NOT TESTED | |
| RBAC-003 | Musyrif | Buka presensi/asrama | Data dibatasi sesuai kamar bila ditugaskan | — | NOT TESTED | |
| RBAC-004 | Wali Santri | Buka portal wali | Hanya data anak sendiri yang tampil | — | NOT TESTED | |
| RBAC-005 | Semua | Akses URL/API modul terlarang langsung | Respons 403/redirect dan tidak ada data bocor | — | NOT TESTED | |

## Kriteria kelulusan

- Tidak ada skenario berstatus **FAIL**.
- Skenario pembayaran memakai sandbox sampai kredensial produksi dan webhook diverifikasi.
- Skenario restore dan cleanup hanya memakai backup/data uji yang dapat dipulihkan.
- Bukti screenshot, waktu uji, dan akun penguji dilampirkan pada catatan rilis.
