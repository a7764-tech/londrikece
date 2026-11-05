# Londri Kece — Kasir Laundry

Aplikasi kasir laundry kiloan berbasis Next.js untuk mengelola transaksi, antrean, riwayat, laporan, dan tarif.

## Menjalankan aplikasi

```bash
npm install
npm run dev
```

Sebelum menjalankan aplikasi, salin `.env.example` menjadi `.env.local`, lalu atur username/password kasir dan ganti `AUTH_SECRET` dengan nilai acak minimal 32 karakter. `DATABASE_URL` boleh dikosongkan untuk pengembangan lokal dengan penyimpanan JSON. Buat secret aman dengan:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Buka `http://localhost:3000` dan masuk melalui halaman login. Sesi kasir berlaku selama delapan jam; tombol **Keluar** menghapus sesi. Halaman status pelanggan tetap dapat dibuka tanpa login.

## Fitur

- Dashboard dengan ringkasan pendapatan, antrean, dan laporan.
- Form transaksi dengan nama pelanggan, WhatsApp, layanan, berat, catatan, dan opsi ekspres.
- Antrean dengan pencarian, filter status, detail nota, dan pembaruan status pengerjaan.
- Konfirmasi pembayaran dengan pilihan metode Tunai, QRIS, atau Transfer.
- Riwayat dengan rentang tanggal, pencarian, filter pembayaran, pagination, dan ekspor CSV.
- Rekap laporan dan pengaturan tarif yang berlaku untuk transaksi baru.
- Struk transaksi siap cetak dengan kode pelacakan enam digit dan QR menuju halaman pelanggan.
- Halaman khusus `/cek-status` untuk pelanggan memasukkan kode enam digit secara manual.
- Halaman `/status/[kode]` memperbarui status pengerjaan otomatis.
- Login kasir dengan cookie sesi `HttpOnly`, `SameSite`, dan masa berlaku terbatas.

## Konfigurasi tarif

Nilai awal tarif adalah contoh. Ubah tarif per kilogram dan biaya ekspres melalui menu **Pengaturan Tarif**. Transaksi menyimpan nilai harga saat dibuat sehingga perubahan tarif tidak mengubah transaksi lama.

## Penyimpanan

Saat berjalan lokal tanpa `DATABASE_URL`, data disimpan pada file JSON di folder `data/`. Jika `DATABASE_URL` tersedia, transaksi dan tarif menggunakan Neon Postgres. Di Vercel, `DATABASE_URL` wajib diisi; aplikasi tidak akan diam-diam menyimpan data ke filesystem serverless.

## Publikasi ke Vercel

1. Push project ke repository GitHub.
2. Buat database PostgreSQL di Neon, lalu salin connection string pooled (`DATABASE_URL`).
3. Jika ingin membawa data lokal, buat cadangan folder `data/`, masukkan `DATABASE_URL` Neon ke `.env.local`, lalu jalankan `npm run db:import-local`. Skrip hanya mengimpor ke database kosong dan membatalkan proses jika database sudah berisi data.
4. Import repository tersebut di [Vercel](https://vercel.com/new).
5. Tambahkan variabel lingkungan untuk semua environment yang diperlukan:
   - `DATABASE_URL` — connection string Neon.
   - `CASHIER_USERNAME` — username kasir.
   - `CASHIER_PASSWORD` — password kasir yang kuat.
   - `AUTH_SECRET` — secret acak minimal 32 karakter.
6. Deploy. Setelah deploy, uji login kasir, buat transaksi, lalu buka domain publik `/cek-status` untuk memastikan alur pelanggan dapat diakses.

Contoh membuat `AUTH_SECRET`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Jangan commit `.env.local` atau mengirimkan nilai rahasia melalui kode sumber. Vercel membutuhkan `DATABASE_URL` dan variabel autentikasi di **Project Settings → Environment Variables**.

## Endpoint

- `POST /api/auth/login` — autentikasi kasir dan buat sesi.
- `POST /api/auth/logout` — akhiri sesi kasir.
- `GET /api/tariffs` — konfigurasi tarif.
- `PUT /api/tariffs` — simpan konfigurasi tarif.
- `GET /api/transactions` — antrean transaksi.
- `POST /api/transactions` — validasi dan simpan transaksi baru.
- `PATCH /api/transactions/:id` — tandai pengerjaan selesai atau pembayaran lunas dengan metode pembayaran.
- `GET /api/track/:code` — status pengerjaan publik minimal untuk kode pelacakan.

Endpoint transaksi dan tarif hanya dapat diakses setelah login kasir.

QR pada struk hanya membuka halaman `/cek-status`; pelanggan tetap memasukkan kode enam digit dari struk secara manual. Agar tautan QR dapat dibuka dari perangkat pelanggan, deploy aplikasi ke domain/host publik; alamat `localhost` hanya berlaku di perangkat kasir.
