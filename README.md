# 🎓 Operasi Lulus: Exam Cheat Simulator 3D

[![Three.js](https://img.shields.io/badge/Three.js-r160-black?logo=three.js)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Operasi Lulus: Exam Cheat Simulator 3D** adalah game simulasi web 3D berbasis *first-person seated view* dengan mekanik *stealth*. Pemain berperan sebagai seorang siswa yang harus menyelesaikan Ujian Nasional Fisika (5 soal di Lembar Jawaban Komputer / LJK) dalam waktu 90 detik tanpa ketahuan oleh Pengawas Ujian!

---

## 📸 Fitur Utama

1. **First-Person Seated View & Realistic Neck Look**
   - Lingkungan ruang kelas 3D yang kaya detail: meja kayu, kursi, papan tulis kapur, jendela kaca, jam dinding aktif, dan siswa-siswa NPC.
   - Kontrol kamera leher manusia realistis (Hybrid Mouse Look): bebas menoleh ke sekeliling kelas, menunduk ke meja lembar ujian, atau mendongak ke arah pengawas.

2. **AI Pengawas Ujian & Stealth Mechanic (Line of Sight)**
   - Karakter Pengawas 3D berpatroli mengelilingi lorong kelas mengikuti titik *waypoints*.
   - Sistem deteksi kerucut pandang *Field of View* (FOV 60°) dan kalkulasi jarak (*Line of Sight*).
   - **Suspicion Meter (0% - 100%):** Meteran kecurigaan akan naik drastis dengan efek visual *vignette* merah tepi layar dan getaran layar (*screen shake*) jika Anda menyontek saat pengawas sedang melihat ke arah Anda.

3. **Mekanik Menyontek Interaktif**
   - **Kerepekan Kertas Rahasia (`Tahan Tombol E`):** Mengeluarkan gulungan contekan di bawah meja. Kunci jawaban perlahan menjadi jelas (*unblur*) seiring Anda membaca.
   - **Melirik Lembar Jawaban Teman (`Tahan Tombol D`):** Kamera condong mendekati meja Budi Santoso (siswa pintar di sebelah kanan) untuk menyalin jawabannya.
   - **Mengisi LJK (`Tahan Klik Kiri / Spasi`):** Mengarsir bulatan jawaban pensil 2B pada lembar LJK 3D secara dinamis setelah kunci jawaban dihafal.

4. **Audio Prosedural (Web Audio API)**
   - Efek suara tanpa aset file eksternal: detak jantung (*heartbeat*) dinamis yang temponya meningkat saat situasi genting, gesekan pensil menulis, gemerisik kertas contekan, lonceng ide, hingga peluit razia pengawas.

5. **Modern HUD Overlay (Tailwind CSS)**
   - Antarmuka responsif dengan pengukur waktu ujian, progres soal (0/5), status pengetahuan soal, notifikasi aksi kontekstual, dan tombol interaksi layar sentuh/mouse.

---

## 🕹️ Panduan Kontrol

| Aksi | Keyboard / Mouse | Keterangan |
|------|------------------|------------|
| **Menoleh Bebas** | `Gerakkan Mouse` | Mengarahkan pandangan kepala ke seluruh ruangan |
| **Kunci Kursor (FPS)** | `Klik Layar Canvas` | Mengaktifkan mode Pointer Lock |
| **Buka Kerepekan** | `Tahan E` atau Tombol `Kerepekan` | Membaca kertas contekan rahasia di bawah meja |
| **Lirik Meja Budi** | `Tahan D` atau Tombol `Lirik Kanan` | Mengintip LJK Budi si juara kelas di sebelah kanan |
| **Tulis Jawaban LJK** | `Tahan Klik Kiri` / `Tahan Spasi` | Mengarsir bulatan opsi di LJK (jika sudah tahu kuncinya) |
| **Mute / Unmute** | Tombol `🔊` di Footer | Menyalakan atau mematikan suara efek |

---

## 🚀 Cara Menjalankan Secara Lokal

Pastikan Anda telah menginstal [Node.js](https://nodejs.org/) (versi 16 atau lebih baru).

```bash
# 1. Clone repositori ini
git clone https://github.com/USERNAME/cheating-when-exam-game-web.git

# 2. Masuk ke direktori proyek
cd "cheating-when-exam-game-web"

# 3. Install seluruh dependensi
npm install

# 4. Jalankan development server
npm run dev
```

Buka URL lokal yang muncul di terminal (biasanya `http://localhost:5173/`) pada browser Anda.

### Build untuk Produksi
```bash
npm run build
npm run preview
```

---

## 📁 Struktur Direktori

```text
├── index.html                  # Halaman utama & HUD Overlay UI
├── package.json                # Dependensi proyek & script
├── tailwind.config.js          # Konfigurasi Tailwind CSS
├── postcss.config.js           # Konfigurasi PostCSS
├── src/
│   ├── main.js                 # Game Orchestrator & Loop 60 FPS
│   ├── style.css               # Styling kustom & animasi vignette
│   ├── scene/
│   │   └── ClassroomScene.js   # Setup ruang kelas 3D, meja, LJK, dan kamera
│   ├── ai/
│   │   └── ProctorAI.js        # AI patroli pengawas & sistem deteksi FOV
│   ├── mechanics/
│   │   └── CheatSystem.js      # Logika menyontek, 5 soal fisika, & meteran curiga
│   ├── ui/
│   │   └── ExamHUD.js          # Pengelola tampilan HUD & modal permainan
│   └── audio/
│       └── SoundManager.js     # Efek suara prosedural Web Audio API
```

---

## 📜 Lisensi

Proyek ini dilisensikan di bawah [Lisensi MIT](LICENSE).
Bebas dikembangkan dan dimodifikasi untuk tujuan edukasi dan hiburan! 🎮
