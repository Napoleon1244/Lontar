# lontar ◈

baca karya klasik dunia dalam bahasa indonesia — via [Project Gutenberg](https://www.gutenberg.org).

→ **[buka lontar](https://napoleon1244.github.io/lontar)**

---

## cara pakai

1. buka [gutenberg.org](https://www.gutenberg.org), cari buku
2. salin URL atau catat ID-nya (angka di URL)
3. tempel di lontar, klik **muat →**
4. lontar ambil teks, terjemahkan otomatis ke Bahasa Indonesia, lalu tampilkan

---

## deploy ke github pages

1. fork / clone repo ini
2. **Settings → Pages → Source: GitHub Actions**
3. push ke `main` — Actions akan auto-deploy

tidak ada build step. tidak ada dependency. murni HTML + CSS + JS.

---

## fitur

- ambil buku via URL / ID Gutenberg
- terjemahan otomatis ke Bahasa Indonesia (Google Translate)
- unduh sebagai `.txt` atau `.md`
- 5 tema: terang, gelap, sepia, terminal, abu
- ukuran huruf & lebar kolom bisa diatur
- CSS kustom (edit sesuai selera)
- riwayat buku tersimpan di browser
- cache buku yang sudah diterjemahkan
- PWA — bisa di-install, shell bisa offline

---

## struktur repo

```
lontar/
├── .github/workflows/deploy.yml   ← GitHub Actions (auto-deploy ke Pages)
├── index.html                     ← struktur halaman (SPA)
├── style.css                      ← tampilan
├── app.js                         ← semua logika
├── sw.js                          ← service worker
├── manifest.json                  ← PWA manifest
└── icon.svg                       ← ikon
```

---

MIT License
