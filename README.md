# Node.js + Firebird Docker Environment

Proyek ini menyediakan setup lingkungan Docker menggunakan Docker Compose untuk menjalankan aplikasi Node.js (Express) yang terhubung ke database Firebird.

## Prasyarat
Pastikan Anda sudah menginstal:
*   [Docker](https://www.docker.com/)
*   [Docker Compose](https://docs.docker.com/compose/)

## Cara Menjalankan

1.  **Bangun dan jalankan kontainer:**
    ```bash
    docker compose up --build
    ```
    Perintah ini akan:
    *   Mendownload image resmi `firebirdsql/firebird`.
    *   Membuat database secara otomatis di `/var/lib/firebird/data/testdb.fdb`.
    *   Menjalankan skrip inisialisasi SQL dari `init-scripts/01-init.sql` untuk membuat tabel `USERS` dan mengisi beberapa data awal.
    *   Membangun image Node.js dari `Dockerfile` dan menginstal dependensi.
    *   Menjalankan server Node.js pada port `3000`.

2.  **Akses Aplikasi:**
    *   **Cek Status Koneksi Database:**
        Akses [http://localhost:3000/](http://localhost:3000/) di browser atau via curl:
        ```bash
        curl http://localhost:3000/
        ```
        Respons jika sukses:
        ```json
        {
          "status": "ok",
          "message": "Connected to Firebird successfully!"
        }
        ```

    *   **Ambil Daftar Pengguna:**
        ```bash
        curl http://localhost:3000/users
        ```
        Respons:
        ```json
        [
          {"ID": 1, "NAME": "Admin", "EMAIL": "admin@example.com"},
          {"ID": 2, "NAME": "John Doe", "EMAIL": "john@example.com"}
        ]
        ```

    *   **Tambah Pengguna Baru:**
        ```bash
        curl -X POST http://localhost:3000/users \
             -H "Content-Type: application/json" \
             -d '{"id": 3, "name": "Jane Doe", "email": "jane@example.com"}'
        ```
        Respons:
        ```json
        {
          "message": "User added successfully",
          "user": {
            "id": 3,
            "name": "Jane Doe",
            "email": "jane@example.com"
          }
        }
        ```

## Struktur Proyek
*   `docker-compose.yml` - Konfigurasi Docker Compose untuk layanan database dan aplikasi.
*   `Dockerfile` - Langkah-langkah build image untuk aplikasi Node.js.
*   `index.js` - Kode aplikasi Express yang menggunakan pustaka `node-firebird`.
*   `package.json` - Daftar dependensi Node.js (`express` dan `node-firebird`).
*   `init-scripts/` - Direktori berisi SQL script yang akan dieksekusi otomatis saat inisialisasi database pertama kali.
