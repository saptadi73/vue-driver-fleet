# Driver Fleet — release 25 November 2026

Source release: `3d5617b1b81655ac1cd601923e5988baf9c58efe`, branch `main`.
Commit telah dipush sebelum deployment.

- Production: https://angkutan.kanjabung.com, server `103.150.195.91`, SSH user
  `develop` melalui Pageant, Nginx root `/var/www/angkutan`.
- Build/type-check, 4 unit tests, dan Chrome dengan API simulasi lulus.
- Release mencakup nomor trip, grouping kendaraan/tanggal, rute dan kendaraan
  read-only, tanggal/jam UTC ke zona browser, serta penanganan error bisnis API.
- Backup sebelum deployment:
  `/var/backups/driver-fleet/20261125T045600Z-3d5617b1b81655ac1cd601923e5988baf9c58efe`.
- Index HTTPS diverifikasi identik dengan hasil build; `/release.json` melaporkan
  commit source release. Hashed asset lama dipertahankan untuk tab yang masih aktif.
- HTTPS frontend dan login Odoo mendapat 200. Preflight API Fleet dari origin
  frontend mendapat 204 dengan origin yang benar dan credentials diizinkan.

Backend Fleet `14.0.1.2.14` berhasil di-deploy dan di-upgrade setelah push Git
internal berhasil pada 25 November 2026. Source backend `8b5d94e`, service Odoo
aktif, dan data 5.893 booking lama terverifikasi tetap utuh selain penambahan nomor
trip; waktu selesai historis tetap kosong. Backup database/filestore/modul dibuat
sebelum upgrade. HTTPS Odoo/frontend, asset JS/CSS, dan preflight CORS lulus.

UAT session driver, upload filestore, dan konfirmasi pada backend aktual tetap
terbuka. Field frontend bersifat opsional dengan fallback nomor booking.
