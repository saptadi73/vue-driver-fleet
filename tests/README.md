# Verifikasi Driver Fleet

Jalankan `npm.cmd test` untuk unit test dan `npm.cmd run build` untuk type-check
serta build produksi.

## Pengujian browser dengan API simulasi

1. Jalankan `npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort`.
2. Pada terminal lain, jalankan `npm.cmd run test:browser`.

Pengujian membutuhkan Chrome lokal. Untuk Edge, set `$env:FLEET_UAT_CHANNEL='msedge'`
sebelum menjalankan tes. Playwright berjalan headless, mengintersep endpoint Fleet,
dan memakai fixture simulasi. Tes tidak login atau mengubah data Odoo production.
Screenshot terakhir disimpan sebagai `fleet-browser-uat.png` di folder temporary OS.

Cakupan: login, nomor trip, rute/kendaraan read-only, simpan draft, pelestarian file
lama, upload baru, pesan error bisnis, dan konfirmasi eksplisit. Pengujian ini tidak
menggantikan UAT login/session/CORS serta penyimpanan file pada backend Odoo aktual.
