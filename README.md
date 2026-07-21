# SFA PUSAT - HQ Central Control & Multi-Depo System

Proyek ini merupakan server pusat **SFA PUSAT (Headquarters)** yang bertugas mengelola token aktivasi, memverifikasi koneksi, serta melakukan kontrol dan agregasi data transaksi dari unit **SFA DEPO**.

## Fitur Utama SFA PUSAT

1. **Depo Token Generation & Activation Verification**:
   - Menghasilkan token terenkripsi AES-256-GCM untuk SFA DEPO cabang.
   - Endpoint `/api/pusat/verify-token` untuk validasi token dan penguncian IP Public SFA DEPO.
2. **Koneksi & Control SFA DEPO**:
   - Endpoint `/api/pusat/ping` untuk pemantauan heartbeat/status aktif SFA DEPO.
   - Fitur Kontrol (Blokir Akses Depo, Aktifkan Kembali, atau Hapus Depo).
3. **Pusat Control Panel (HQ Dashboard)**:
   - Dashboard visual realtime untuk memantau status Depo, jumlah transaksi, dan manajemen token.
4. **Database PostgreSQL Central**:
   - Menyimpan dan menyajikan data terpusat `master_sfa_produk`, `master_pelanggan`, dan `sfa_penjualan`.

## Cara Menjalankan

1. **Jalankan Docker Compose:**
   ```bash
   docker compose up --build
   ```

2. **Akses Dashboard HQ Pusat:**
   Akses `http://localhost:3000/` di browser.

## Endpoint API Utama

- `GET /api/status` : Status server SFA PUSAT dan ringkasan Depo terdaftar.
- `POST /api/pusat/verify-token` : Endpoint verifikasi token yang dipanggil oleh SFA DEPO.
- `POST /api/pusat/ping` : Endpoint heartbeat ping dari SFA DEPO.
- `GET /api/pusat/depos` : Mengambil daftar seluruh Depo terdaftar.
- `POST /api/pusat/generate-token` : Membuat token aktivasi Depo baru.
- `POST /api/pusat/depo/control` : Memblokir/mengaktifkan kembali akses SFA DEPO.
- `GET /api/penjualan` : Mengambil data transaksi penjualan terpusat.

