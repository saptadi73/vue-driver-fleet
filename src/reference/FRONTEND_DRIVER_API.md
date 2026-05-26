# Frontend Driver Fleet API

Endpoint ini disiapkan untuk frontend sopir yang melengkapi data `Booking Armada`
yang masih `Draft`. Flow ini dipakai ketika booking awal baru berisi tanggal,
produk, dan destinasi, lalu sopir melengkapi armada, quantity, driver, serta
foto/file surat jalan saat operasional.

Semua endpoint menggunakan JSON-RPC Odoo. Setelah login melalui
`/api/fleet/authenticate`, frontend memakai cookie session yang sama untuk
endpoint `auth='user'`.

## Login

`POST /api/fleet/authenticate`

Payload:

```json
{
  "params": {
    "db": "nama_database",
    "login": "driver@example.com",
    "password": "password"
  }
}
```

Response berisi `session_id`, data user, employee, dan driver jika mapping sudah
dibuat.

## Konteks Driver

`POST /api/fleet/driver/context`

Mengembalikan user login, employee, dan master `grt.fleet.driver` yang aktif.
Driver dicari dari `hr.employee.user_id = user login`, lalu
`grt.fleet.driver.employee_id = employee`.

Field `driver` dari response ini adalah driver operasional yang akan dipakai
backend saat update booking. Frontend tidak perlu mengirim `driver_id`.

## Daftar Booking Draft

`POST /api/fleet/driver/bookings`

Payload opsional:

```json
{
  "params": {
    "page": 1,
    "limit": 50,
    "search": "BOOK",
    "states": ["draft"]
  }
}
```

Default hanya menampilkan booking `draft` yang belum punya driver atau sudah
ditugaskan ke driver login.

## Detail Booking

`POST /api/fleet/driver/bookings/get`

Payload:

```json
{
  "params": {
    "booking_id": 12,
    "include_file": false
  }
}
```

Booking hanya dapat dibuka untuk edit jika masih `draft` dan belum ditugaskan ke
driver lain.

Response `booking` sudah membawa data armada lengkap pada key `vehicle`, selain
field ringkas `vehicle_id`. Contoh struktur:

```json
{
  "booking": {
    "id": 12,
    "name": "FB/00012",
    "state": "draft",
    "vehicle_id": {"id": 5, "name": "N 1234 AA"},
    "vehicle": {
      "id": 5,
      "name": "N 1234 AA",
      "license_plate": "N 1234 AA",
      "model_id": {"id": 8, "name": "Colt Diesel"},
      "brand_id": {"id": 2, "name": "Mitsubishi"},
      "driver_id": {"id": 3, "name": "Budi"},
      "driver": {
        "id": 3,
        "code": "DRV/0003",
        "name": "Budi",
        "mobile": "08123456789"
      },
      "customer_id": {"id": 4, "name": "Customer Fleet"},
      "region_id": {"id": 6, "name": "Malang"}
    }
  }
}
```

## Update atau Submit Booking

`POST /api/fleet/driver/bookings/update`

Payload:

```json
{
  "params": {
    "booking_id": 12,
    "vehicle_id": 5,
    "product_id": 9,
    "quantity": 10,
    "km": 42,
    "delivery_order_number": "SJ-001",
    "delivery_order_filename": "surat-jalan.jpg",
    "delivery_order_file": "/9j/4AAQSkZJRgABAQAAAQABAAD...",
    "note": "Catatan sopir",
    "confirm": true
  }
}
```

Catatan:

- `driver_id` tidak diterima dari frontend. Backend selalu mengisinya dari
  driver akun login.
- `vehicle_id` dan `product_id` divalidasi terhadap Business Category akun.
- Frontend tidak perlu dan tidak boleh mengirim field tarif/harga:
  `driver_tariff`, `fuel_tariff`, `subtotal_tariff`, `sale_price_unit`, atau
  `sale_subtotal`. Jika dikirim, API akan menolak request.
- Jika booking dibuat/diupdate dari backend lain tanpa `driver_id`, Odoo akan
  memakai `Driver Default` dari armada. Khusus endpoint driver ini tetap memakai
  driver akun login agar sopir tidak bisa memilih driver lain.
- `delivery_order_file` harus base64 valid. Data URL seperti
  `data:image/jpeg;base64,...` juga diterima.
- Jika `confirm = true`, booking langsung dipindah dari `draft` ke
  `confirmed` setelah update berhasil.

## Daftar Armada

`POST /api/fleet/driver/vehicles`

Payload opsional:

```json
{
  "params": {
    "page": 1,
    "limit": 100,
    "search": "N 1234",
    "include_inactive": false
  }
}
```

Response mengembalikan `fleet.vehicle` aktif beserta nomor polisi, model,
brand, kategori, company, odometer, driver default, customer fleet, business
category armada, catatan armada, dan wilayah basis.

Setiap item armada membawa:
- `driver_id`: ringkasan Driver Default armada untuk tampilan dropdown
- `driver`: detail Driver Default, termasuk kode, nama, telepon, dan status
- `customer_id`: Customer Fleet default armada
- `business_category_id`: Business Category Armada

Data armada difilter berdasarkan Business Category akun. Secara default hanya
armada dengan Business Category yang sama yang ditampilkan. Kirim
`include_uncategorized: true` hanya jika frontend perlu menampilkan armada lama
yang belum diberi Business Category.

## Daftar Produk Fleet

`POST /api/fleet/driver/products`

Payload opsional:

```json
{
  "params": {
    "page": 1,
    "limit": 100,
    "search": "angkutan",
    "include_inactive": false
  }
}
```

Response mengembalikan produk `sale_ok` yang sesuai Business Category akun,
termasuk kode produk, barcode, satuan, harga jual, Business Category, tarif
driver default, dan tarif BBM default.

## Dropdown Booking Driver

`POST /api/fleet/driver/dropdowns`

Payload opsional:

```json
{
  "params": {
    "limit": 200,
    "include_uncategorized": true
  }
}
```

Endpoint ini mengembalikan `business_category`, `driver`, `vehicles`, dan
`products` dalam satu response agar frontend bisa langsung mengisi dropdown
booking.

Rekomendasi frontend:
- panggil endpoint ini saat halaman checklist booking dibuka
- gunakan `driver` di root response untuk menampilkan sopir login
- gunakan `vehicles[].driver` hanya sebagai informasi Driver Default armada
- jangan kirim `driver_id` saat update booking; cukup kirim `vehicle_id`

## Setup Wajib

Admin perlu mengisi `Employee` pada master `Fleet Management / Master Data /
Driver`. Employee tersebut harus memiliki `Related User` ke akun login sopir.

User sopir juga perlu masuk grup `GRT Fleet Management / Fleet User`.
