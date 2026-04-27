# 🖼️ Hero Proxy Rewriter With Dashboard 

Userscript canggih untuk menulis ulang sumber gambar/URL agar melewati proxy pilihanmu. Dilengkapi dashboard interaktif, aturan filter gaya AdBlock, custom selectors.

---

## ✨ Fitur Utama

- **Pencegahan *double loading*** – Override properti `src` di prototype elemen gambar, sehingga browser **tidak pernah** memuat URL asli.
- **Dashboard interaktif** – Panel apung dengan tab Settings, Rules, Stats, dan Help (multi‑bahasa ID/EN).
- **Mode penargetan fleksibel** – Domain, kata kunci URL, semua URL, atau aturan gaya AdBlock.
- **Aturan AdBlock** – Dukungan sintaks filter `||`, `@@`, `*`, `^`, regex (`/.../`).
- **Custom selectors** – Tentukan elemen & atribut kustom yang ingin ditulis ulang (contoh `data-bg`, `data-original`).
- **Filter host privat** – Otomatis mengecualikan localhost, IP privat, domain `.local`, `.test`, dll.
- **Transformasi gambar** – Atur kualitas, grayscale, format output, progressive JPEG, dan parameter tambahan.
- **Statistik sesi** – Pantau total penulisan ulang, waktu terakhir, dan host unik.
- **Tombol apung** – Dapat diseret & menempel di sudut layar.
- **Penyimpanan global** – Konfigurasi disimpan lintas sesi (menggunakan `GM_setValue` / `localStorage`).

---

## 📥 Instalasi

1. Pastikan kamu memiliki ekstensi **Tampermonkey** (atau Violentmonkey) di browser.
2. Buka script di [raw GitHub](https://raw.githubusercontent.com/Aerty-G/hero-proxy-rewriter/refs/heads/main/userscript.js).
3. Klik ikon Tampermonkey → **Buat skrip baru***, tempelkan kode, lalu simpan.
4. Muat ulang halaman target. Tombol ⚙ akan muncul di sudut kanan bawah.

---

## ⚙️ Konfigurasi Default

Semua pengaturan disimpan dalam objek `state.settings`:

```javascript
{
  enabled: false,               // Aktif/nonaktifkan rewrite
  proxyBase: '',               // URL proxy (kosong = mati)
  mode: 'img',                 // 'img' | 'url' | 'both'
  targetType: 'all',           // 'domain' | 'keyword' | 'all' | 'adblock'
  targets: [],                 // Daftar domain/kata kunci
  adblockRules: '',            // Aturan filter, satu per baris
  customSelectors: '',         // Selector kustom (format: selector|attr)
  includeSubdomains: true,     // Ikutkan subdomain
  rewriteSrc: true,
  rewriteSrcset: true,
  rewriteDataSrc: true,
  rewriteBackgroundImage: false,
  liveObserve: true,           // Pantau perubahan DOM
  excludeAlreadyProxied: true, // Lewati URL yang sudah diproxy
  excludePrivateHosts: true,   // Kecualikan host lokal/privat
  autoScanInterval: 0,         // Scan berkala (detik, 0=off)
  quality: 80,                 // Kualitas (0-100)
  grayscale: false,
  forceFormat: 'original',     // 'original' | 'jpeg' | 'png' | 'webp' | 'avif'
  progressiveJpeg: false,
  extraParams: '',             // Param tambahan key=value, satu per baris
  togglePosition: null,        // Posisi tombol apung
  showPanel: false,            // Buka panel saat memuat
  language: 'en'               // 'en' | 'id'
}
```

---

## 🧩 Penggunaan

Setelah instal, klik tombol ⚙ untuk membuka dashboard. Terdapat 4 tab:

### ⚙️ **Settings**
- **Proxy Base URL** – Masukkan endpoint proxy (contoh: `https://images.weserv.nl/`).
- **Mode** – Pilih *Gambar saja*, *URL tertentu*, atau *Keduanya*.
- **Target Type** – Tentukan cara mengenali URL yang akan ditulis ulang.
- **Targets** – Domain atau kata kunci (satu per baris).
- **Behaviour** – Centang atribut apa yang ingin ditulis ulang, aktifkan *live observe*, *exclude local IP*, dll.
- **Custom Selectors** – Tambahkan selector CSS + atribut khusus.
- **Transformation** – Atur kualitas, grayscale, format output, progressive JPEG, dan parameter tambahan.
- **Language** – Pilih bahasa antarmuka.

### 📜 **Rules** (AdBlock)
- Berlaku hanya jika **Target Type = AdBlock rules**.
- Tulis aturan filter satu per baris.
- Sintaks: `||domain.com^` (cocokkan domain), `@@` untuk pengecualian, `*` wildcard, `^` pemisah akhir domain/path, `/regex/`.
- Jika tidak ada aturan include, tidak ada URL yang diproxy.
- Contoh: 
  ```
  ||example.com^
  @@||example.com/logo.svg^
  /\.jpg$/
  ```

### 📊 **Stats**
- Menampilkan total penulisan ulang, waktu terakhir, dan jumlah host unik yang di‑proxy.
- Dapat direset kapan saja.

### ❓ **Help**
- Panduan lengkap langkah‑demi‑langkah, termasuk contoh penggunaan.
- Tersedia dalam bahasa Indonesia dan Inggris.

---

## 📐 Aturan AdBlock – Sintaks & Logika

| Simbol | Arti | Contoh |
|--------|------|--------|
| `\|\|` | Cocokkan dari awal hostname (termasuk subdomain) | `\|\|iklan.com^` |
| `@@` | Pengecualian (jangan proxy) | `@@\|\|mysite.com/logo.svg^` |
| `*` | Wildcard (cocokkan karakter apa pun) | `*://*.google.com/images/*` |
| `^` | Pemisah akhir domain/path (cocok `/`, `?`, `#`, atau akhir) | `\|\|example.com^` cocok `example.com`, `example.com/`, `example.com?q=a` |
| `/regex/` | Pola regex literal | `/\.(png\|jpg)$/` |

**Logika pencocokan:**
1. Periksa aturan pengecualian (`@@`). Jika cocok, URL diabaikan.
2. Jika tidak ada aturan *include* (tanpa `@@`), maka tidak ada URL yang diproxy.
3. Jika ada aturan *include*, hanya URL yang cocok aturan tersebut yang diproxy (kecuali dikecualikan).

---

## 🎯 Custom Selectors

Gunakan ini untuk menangani situs yang menyimpan URL di atribut non‑standar.

Format: `selector|atribut` (satu per baris). Jika tidak ada `|`, atribut default adalah `src`.

Contoh:
```
.hero-bg|data-bg
[data-setBg]
#preview-img|data-src
```

- Baris pertama: rewrite `data-bg` pada elemen dengan class `hero-bg`.
- Baris kedua: rewrite `src` pada elemen dengan atribut `data-setBg`.
- Baris ketiga: rewrite `data-src` pada elemen dengan ID `preview-img`.

---

## 🔬 Cara Kerja (Mencegah Double Loading)

1. **Prototype Override** – Sebelum halaman dimuat (`@run-at document-start`), setter `HTMLImageElement.prototype.src` diganti. Setiap kali `<img src="...">` diparsing atau JavaScript menyetel `img.src`, setter langsung mengganti URL asli dengan URL proxy. Browser **tidak pernah** memulai permintaan ke URL asli.

2. **MutationObserver & Auto Scan** – Untuk elemen yang ditambahkan setelah pemuatan awal (dan untuk atribut seperti `data-src`, `background-image`, custom selectors), observer memantau perubahan DOM dan langsung memproses elemen baru.

3. **Base URL Resolution** – URL relatif (seperti `logo.svg` atau `../img/photo.jpg`) di‑resolve menjadi absolut menggunakan `document.baseURI` (termasuk tag `<base>`) sebelum dikirim ke proxy.

---

## 🛡️ Pengecualian Host Privat

Secara default, script tidak akan memproses host berikut:
- `localhost`, `127.0.0.1`, `::1`
- IP privat: `10.x.x.x`, `172.16.x.x–172.31.x.x`, `192.168.x.x`, `169.254.x.x`
- Domain: `.local`, `.test`, `.example`, `.invalid`, `.internal`, `.lan`, `.corp`, `.home`
- IPv6 link‑local / unique‑local

Fitur ini dapat dinonaktifkan di tab Settings.

---

## 🧱 Fungsi‑Fungsi Utama (dalam kode)

| Fungsi | Deskripsi |
|--------|-----------|
| `installPrototypeOverrides()` | Override setter `src` dan `srcset` untuk mencegah fetch asli. |
| `compileAdblockRules(text)` | Mengompilasi teks aturan menjadi array objek `{regex, exclude}`. |
| `matchAdblock(url)` | Mencocokkan URL absolut terhadap aturan yang sudah dikompilasi. |
| `tryParseUrlAbsolute(val, base)` | Me‑resolve URL mentah (bisa relatif) menjadi objek URL absolut. |
| `shouldRewriteUrl(raw, skipProxied, base)` | Memutuskan apakah suatu URL perlu ditulis ulang (memeriksa filter privat, target, dll.). |
| `buildProxyUrl(rawUrl, base)` | Membangun URL proxy lengkap dengan parameter transformasi. |
| `rewriteSrcset(srcset, base)` | Menulis ulang setiap entri dalam atribut `srcset`. |
| `processElement(el)` | Memproses satu elemen DOM (standar + custom). |
| `scanAll()` | Memindai seluruh dokumen untuk elemen yang perlu ditulis ulang. |
| `startObserver()` / `stopObserver()` | Mengelola MutationObserver. |
| `recordRewrite(absoluteUrl)` | Mencatat statistik penulisan ulang. |
| `showToast(msg, type)` | Menampilkan notifikasi kecil di top window (hanya di tab utama). |
| `createUI()` | Membangun seluruh panel dashboard (hanya di top window). |

---

## 🌐 Multi‑Bahasa

Script mendukung **Bahasa Indonesia** dan **English**. Pilih melalui dropdown di tab Settings. Semua label, tooltip, dan panduan akan berubah seketika.

---

## 📝 Contoh Penggunaan Umum

1. **Proxy semua gambar di `example.com`**  
   - Mode: Gambar saja  
   - Target Type: Domain  
   - Targets: `example.com`

2. **Proxy semua gambar kecuali logo**  
   - Target Type: AdBlock rules  
   - Rules:
     ```
     ||example.com^
     @@||example.com/logo.svg^
     ```

3. **Rewrite atribut data-original pada elemen lazy‑load**  
   - Custom Selectors: `.lazy-img|data-original`

---

## ❓ Troubleshooting

- **Tombol tidak muncul** – Pastikan script berjalan di top‑level window (bukan di dalam iframe). UI sengaja hanya dibuat di tab utama.
- **Gambar masih double loading** – Periksa apakah `excludeAlreadyProxied` menyala, dan pastikan `proxyBase` tidak kosong.
- **Aturan AdBlock tidak berfungsi** – Ingat, jika tidak ada aturan *include* (tanpa `@@`), tidak ada URL yang diproxy. Tambahkan setidaknya satu aturan include untuk mulai memproses.
- **URL relatif tidak ter‑proxy** – Script otomatis me‑resolve dengan base halaman. Jika masih gagal, periksa apakah ada tag `<base>` yang salah atau halaman dimuat via protokol `file:`.

---

## 📄 Lisensi

MIT – Silakan digunakan, dimodifikasi, dan didistribusikan secara bebas.

---

## 🤝 Kontribusi

Pull request, issue, dan saran sangat diterima. Silakan buka [halaman Issues](https://github.com/Aerty-G/hero-proxy-rewriter/issues) untuk melaporkan bug atau meminta fitur.

---
