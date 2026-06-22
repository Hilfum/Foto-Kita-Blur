# Foto Kita Blur

Project kecil buat ngikutin tren foto estetik yang lagi rame, terinspirasi dari lagunya Sal Priadi. Intinya kamera browser ditambah efek blur yang nyala otomatis pas kasih pose ✌️.

Coba langsung di [foto-kita-blur-murex.vercel.app](https://foto-kita-blur-murex.vercel.app)

## Cara pakainya

Buka halamannya, klik "Mulai Kamera", terus tinggal pose santai aja di depan kamera. Kalau mau hasil yang mirror (kayak ngeliat cermin), ada tombol mirror kamera juga. Begitu kasih tanda ✌️, efek blur lambat bakal jalan sendiri — momen itulah yang biasanya jadi shot terbaiknya. Tinggal ambil foto kalau sudah pas.

## Dibangun pakai apa

HTML, CSS, JavaScript polosan. Nggak pakai framework atau library frontend tambahan, semuanya vanilla.

## Isi folder

- `index.html` — halaman utamanya
- `script.js` — logika kamera, deteksi pose, sama efek blur-nya
- `style.css` — tampilan
- `fonts/` — font yang dipakai

## Jalanin di komputer sendiri

```
git clone https://github.com/Hilfum/Foto-Kita-Blur.git
cd Foto-Kita-Blur
```

Tinggal buka `index.html` di browser. Tapi kalau kamera nggak mau nyala, coba jalankan lewat live server (`npx live-server` misalnya) — browser kadang rewel soal izin kamera kalau filenya dibuka langsung tanpa server lokal.

## Lisensi

Belum ada, masih bebas.
