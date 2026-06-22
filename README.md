# Foto Kita Blur

Aplikasi kamera berbasis web yang mereplikasi tren foto estetik "Foto Kita Blur" ala Sal Priadi. Mengambil foto langsung dari kamera browser dengan efek blur otomatis yang aktif saat mendeteksi gestur tangan ✌️.

🔗 **Live demo:** [foto-kita-blur-murex.vercel.app](https://foto-kita-blur-murex.vercel.app)

---

## ✨ Fitur

- 📷 Akses kamera langsung dari browser (tanpa instalasi tambahan)
- 🔄 Mode mirror kamera
- ✌️ Efek blur otomatis saat mendeteksi pose tangan
- 📸 Ambil dan simpan foto
- ⏯️ Kontrol nyala/matikan kamera

---

## 🛠️ Tech Stack

<p align="left">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg" height="30" alt="html5" />
  <img width="10" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg" height="30" alt="css3" />
  <img width="10" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" height="30" alt="javascript" />
</p>

Dibangun dengan HTML, CSS, dan JavaScript murni — tanpa framework atau library frontend tambahan.

---

## 🚀 Cara Menjalankan Secara Lokal

```bash
git clone https://github.com/Hilfum/Foto-Kita-Blur.git
cd Foto-Kita-Blur
```

Buka file `index.html` langsung di browser, atau jalankan dengan live server (disarankan, agar akses kamera browser berjalan normal):

```bash
npx live-server
```

> ⚠️ Browser umumnya memerlukan koneksi HTTPS atau `localhost` agar izin akses kamera diberikan. Membuka file secara langsung (`file://`) bisa menyebabkan kamera tidak terdeteksi di beberapa browser.

---

## 📁 Struktur Folder

```
Foto-Kita-Blur/
├── fonts/        # Font kustom yang digunakan pada tampilan
├── index.html    # Struktur halaman utama
├── script.js     # Logika kamera, deteksi gestur, dan efek blur
└── style.css     # Styling tampilan
```

---
