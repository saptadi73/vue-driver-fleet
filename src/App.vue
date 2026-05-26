<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

type OptionRef = {
  id: number
  name: string
}

type DriverInfo = {
  id?: number
  name?: string
  code?: string
  mobile?: string
}

type Vehicle = {
  id: number
  name: string
  license_plate?: string
  model_id?: OptionRef
  brand_id?: OptionRef
  driver?: DriverInfo
  driver_id?: OptionRef
  region_id?: OptionRef
  odometer?: number
}

type Product = {
  id: number
  name: string
  default_code?: string
  uom_id?: OptionRef
}

type Booking = {
  id: number
  name: string
  state?: string
  date?: string
  booking_date?: string
  date_order?: string
  scheduled_date?: string
  destination?: string
  destination_id?: OptionRef
  product_id?: OptionRef
  quantity?: number
  vehicle_id?: OptionRef
  vehicle?: Vehicle
  km?: number
  delivery_order_number?: string
  note?: string
  customer_id?: OptionRef
}

type LoginResponse = {
  session_id?: string
  user?: { id?: number; name?: string; login?: string }
  employee?: OptionRef
  driver?: DriverInfo
}

const loginForm = reactive({
  host: localStorage.getItem('driverFleetHost') || '',
  db: localStorage.getItem('driverFleetDb') || '',
  login: localStorage.getItem('driverFleetLogin') || '',
  password: '',
})

const updateForm = reactive({
  vehicle_id: '',
  product_id: '',
  quantity: '',
  km: '',
  delivery_order_number: '',
  delivery_order_filename: '',
  delivery_order_file: '',
  note: '',
  confirm: true,
})

const bookings = ref<Booking[]>([])
const vehicles = ref<Vehicle[]>([])
const products = ref<Product[]>([])
const selectedBooking = ref<Booking | null>(null)
const auth = ref<LoginResponse | null>(null)
const search = ref('')
const dateFilter = ref('')
const page = ref(1)
const limit = ref(8)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const loginLoading = ref(false)
const error = ref('')
const success = ref('')
const activeView = ref<'login' | 'list' | 'form'>('login')

const driverName = computed(() => auth.value?.driver?.name || auth.value?.employee?.name || auth.value?.user?.name || 'Driver')
const totalPages = computed(() => Math.max(1, Math.ceil(filteredBookings.value.length / limit.value)))

const filteredBookings = computed(() => {
  return bookings.value.filter((booking) => {
    const haystack = [
      booking.name,
      booking.destination,
      booking.destination_id?.name,
      booking.product_id?.name,
      booking.vehicle_id?.name,
      booking.customer_id?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const matchesSearch = !search.value || haystack.includes(search.value.toLowerCase())
    const matchesDate = !dateFilter.value || normalizeDate(getBookingDate(booking)) === dateFilter.value
    return matchesSearch && matchesDate
  })
})

const visibleBookings = computed(() => {
  const start = (page.value - 1) * limit.value
  return filteredBookings.value.slice(start, start + limit.value)
})

async function rpc<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ params }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.error) {
    const message = data.error?.data?.message || data.error?.message || data.message || 'Request gagal diproses.'
    throw new Error(message)
  }

  return (data.result || data) as T
}

function buildApiUrl(path: string) {
  const host = loginForm.host.trim().replace(/\/+$/, '')
  return host ? `${host}${path}` : path
}

function getBookingDate(booking: Booking) {
  return booking.booking_date || booking.date || booking.date_order || booking.scheduled_date || ''
}

function normalizeDate(value = '') {
  if (!value) return ''
  return value.slice(0, 10)
}

function displayDate(value = '') {
  const normalized = normalizeDate(value)
  if (!normalized) return 'Tanggal belum tersedia'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${normalized}T00:00:00`))
}

function moneylessNumber(value?: number | string) {
  if (value === undefined || value === null || value === '') return '-'
  return new Intl.NumberFormat('id-ID').format(Number(value))
}

async function login() {
  error.value = ''
  success.value = ''
  loginLoading.value = true

  try {
    const result = await rpc<LoginResponse>('/api/fleet/authenticate', {
      db: loginForm.db,
      login: loginForm.login,
      password: loginForm.password,
    })

    auth.value = result
    localStorage.setItem('driverFleetHost', loginForm.host.trim().replace(/\/+$/, ''))
    localStorage.setItem('driverFleetDb', loginForm.db)
    localStorage.setItem('driverFleetLogin', loginForm.login)
    loginForm.password = ''
    activeView.value = 'list'
    await loadBookings()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login gagal.'
  } finally {
    loginLoading.value = false
  }
}

async function loadContext() {
  try {
    auth.value = await rpc<LoginResponse>('/api/fleet/driver/context')
    activeView.value = 'list'
    await loadBookings()
  } catch {
    activeView.value = 'login'
  }
}

async function loadBookings() {
  error.value = ''
  loading.value = true

  try {
    const result = await rpc<{ bookings?: Booking[]; total?: number; count?: number }>('/api/fleet/driver/bookings', {
      page: 1,
      limit: 100,
      search: search.value || undefined,
      states: ['draft'],
    })

    bookings.value = result.bookings || []
    total.value = result.total || result.count || bookings.value.length
    page.value = 1
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Daftar booking gagal dimuat.'
  } finally {
    loading.value = false
  }
}

async function loadDropdowns() {
  if (vehicles.value.length && products.value.length) return

  const result = await rpc<{
    vehicles?: Vehicle[]
    products?: Product[]
    driver?: DriverInfo
  }>('/api/fleet/driver/dropdowns', {
    limit: 200,
    include_uncategorized: true,
  })

  vehicles.value = result.vehicles || []
  products.value = result.products || []
  if (result.driver) auth.value = { ...(auth.value || {}), driver: result.driver }
}

async function openBooking(booking: Booking) {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    const [detail] = await Promise.all([
      rpc<{ booking: Booking }>('/api/fleet/driver/bookings/get', {
        booking_id: booking.id,
        include_file: false,
      }),
      loadDropdowns(),
    ])

    selectedBooking.value = detail.booking
    fillUpdateForm(detail.booking)
    activeView.value = 'form'
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Detail booking gagal dibuka.'
  } finally {
    loading.value = false
  }
}

function fillUpdateForm(booking: Booking) {
  updateForm.vehicle_id = String(booking.vehicle?.id || booking.vehicle_id?.id || '')
  updateForm.product_id = String(booking.product_id?.id || '')
  updateForm.quantity = booking.quantity ? String(booking.quantity) : ''
  updateForm.km = booking.km ? String(booking.km) : ''
  updateForm.delivery_order_number = booking.delivery_order_number || ''
  updateForm.delivery_order_filename = ''
  updateForm.delivery_order_file = ''
  updateForm.note = booking.note || ''
  updateForm.confirm = true
}

async function fileToBase64(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  updateForm.delivery_order_filename = file.name
  updateForm.delivery_order_file = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('File tidak bisa dibaca.'))
    reader.readAsDataURL(file)
  })
}

async function submitBooking() {
  if (!selectedBooking.value) return

  error.value = ''
  success.value = ''
  saving.value = true

  try {
    await rpc('/api/fleet/driver/bookings/update', {
      booking_id: selectedBooking.value.id,
      vehicle_id: Number(updateForm.vehicle_id),
      product_id: Number(updateForm.product_id),
      quantity: Number(updateForm.quantity || 0),
      km: updateForm.km ? Number(updateForm.km) : undefined,
      delivery_order_number: updateForm.delivery_order_number || undefined,
      delivery_order_filename: updateForm.delivery_order_filename || undefined,
      delivery_order_file: updateForm.delivery_order_file || undefined,
      note: updateForm.note || undefined,
      confirm: updateForm.confirm,
    })

    success.value = updateForm.confirm ? 'Booking berhasil diupdate dan dikonfirmasi.' : 'Booking berhasil disimpan.'
    activeView.value = 'list'
    selectedBooking.value = null
    await loadBookings()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Booking gagal disimpan.'
  } finally {
    saving.value = false
  }
}

function logout() {
  auth.value = null
  bookings.value = []
  selectedBooking.value = null
  activeView.value = 'login'
}

function clearFilters() {
  search.value = ''
  dateFilter.value = ''
  page.value = 1
  void loadBookings()
}

onMounted(loadContext)
</script>

<template>
  <main class="min-h-screen bg-[#f6f7ef] text-[#19201f]">
    <section v-if="activeView === 'login'" class="login-screen">
      <div class="login-art" aria-hidden="true">
        <div class="route-line"></div>
        <div class="truck-mark">FM</div>
      </div>

      <form class="login-panel" @submit.prevent="login">
        <p class="eyebrow">Driver Fleet</p>
        <h1>Masuk ke Odoo Fleet</h1>
        <p class="login-copy">Kelola booking draft, lengkapi armada, dan upload surat jalan langsung dari HP.</p>

        <label>
          Odoo Host URL
          <input
            v-model="loginForm.host"
            type="url"
            autocomplete="url"
            placeholder="https://odoo.perusahaan.com"
            required
          />
        </label>

        <label>
          Database
          <input v-model="loginForm.db" type="text" autocomplete="organization" placeholder="nama_database" required />
        </label>

        <label>
          Email / Login
          <input v-model="loginForm.login" type="text" autocomplete="username" placeholder="driver@example.com" required />
        </label>

        <label>
          Password
          <input
            v-model="loginForm.password"
            type="password"
            autocomplete="current-password"
            placeholder="Password Odoo"
            required
          />
        </label>

        <p v-if="error" class="alert error">{{ error }}</p>

        <button class="primary-button" type="submit" :disabled="loginLoading">
          {{ loginLoading ? 'Menghubungkan...' : 'Login' }}
        </button>
      </form>
    </section>

    <section v-else class="app-shell">
      <header class="driver-header">
        <div>
          <p class="eyebrow">Selamat bekerja</p>
          <h1>{{ driverName }}</h1>
        </div>
        <button class="ghost-button" type="button" @click="logout">Keluar</button>
      </header>

      <p v-if="error" class="alert error">{{ error }}</p>
      <p v-if="success" class="alert success">{{ success }}</p>

      <template v-if="activeView === 'list'">
        <section class="toolbar">
          <label class="search-box">
            Cari booking
            <input
              v-model="search"
              type="search"
              placeholder="Nomor, tujuan, produk..."
              @input="page = 1"
              @keyup.enter="loadBookings"
            />
          </label>

          <label class="date-box">
            Tanggal
            <input v-model="dateFilter" type="date" @change="page = 1" />
          </label>

          <div class="toolbar-actions">
            <button class="secondary-button" type="button" @click="loadBookings">Refresh</button>
            <button class="plain-button" type="button" @click="clearFilters">Reset</button>
          </div>
        </section>

        <section class="summary-strip">
          <div>
            <strong>{{ filteredBookings.length }}</strong>
            <span>Draft tersedia</span>
          </div>
          <div>
            <strong>{{ page }}/{{ totalPages }}</strong>
            <span>Halaman</span>
          </div>
        </section>

        <section class="booking-list" aria-live="polite">
          <article v-if="loading" class="empty-state">Memuat booking...</article>

          <article v-for="booking in visibleBookings" :key="booking.id" class="booking-card">
            <div class="booking-topline">
              <span class="status-pill">{{ booking.state || 'draft' }}</span>
              <span>{{ displayDate(getBookingDate(booking)) }}</span>
            </div>
            <h2>{{ booking.name }}</h2>
            <p>{{ booking.destination || booking.destination_id?.name || 'Tujuan belum diisi' }}</p>

            <dl>
              <div>
                <dt>Produk</dt>
                <dd>{{ booking.product_id?.name || '-' }}</dd>
              </div>
              <div>
                <dt>Qty</dt>
                <dd>{{ moneylessNumber(booking.quantity) }}</dd>
              </div>
              <div>
                <dt>Armada</dt>
                <dd>{{ booking.vehicle_id?.name || booking.vehicle?.license_plate || '-' }}</dd>
              </div>
            </dl>

            <button class="card-button" type="button" @click="openBooking(booking)">Update Booking</button>
          </article>

          <article v-if="!loading && !visibleBookings.length" class="empty-state">
            Tidak ada booking yang cocok dengan filter.
          </article>
        </section>

        <nav class="pagination" aria-label="Pagination">
          <button type="button" :disabled="page <= 1" @click="page--">Sebelumnya</button>
          <span>{{ page }} dari {{ totalPages }}</span>
          <button type="button" :disabled="page >= totalPages" @click="page++">Berikutnya</button>
        </nav>
      </template>

      <template v-else-if="activeView === 'form' && selectedBooking">
        <button class="back-button" type="button" @click="activeView = 'list'">Kembali ke daftar</button>

        <section class="booking-hero">
          <span class="status-pill">{{ selectedBooking.state || 'draft' }}</span>
          <h1>{{ selectedBooking.name }}</h1>
          <p>{{ selectedBooking.destination || selectedBooking.destination_id?.name || 'Tujuan belum diisi' }}</p>
          <div class="hero-meta">
            <span>{{ displayDate(getBookingDate(selectedBooking)) }}</span>
            <span>{{ selectedBooking.product_id?.name || 'Produk belum dipilih' }}</span>
          </div>
        </section>

        <form class="update-form" @submit.prevent="submitBooking">
          <label>
            Armada
            <select v-model="updateForm.vehicle_id" required>
              <option value="" disabled>Pilih armada</option>
              <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
                {{ vehicle.license_plate || vehicle.name }} - {{ vehicle.model_id?.name || vehicle.brand_id?.name || 'Fleet' }}
              </option>
            </select>
          </label>

          <label>
            Produk
            <select v-model="updateForm.product_id" required>
              <option value="" disabled>Pilih produk</option>
              <option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.default_code ? `${product.default_code} - ` : '' }}{{ product.name }}
              </option>
            </select>
          </label>

          <div class="form-grid">
            <label>
              Quantity
              <input v-model="updateForm.quantity" type="number" min="0" step="0.01" inputmode="decimal" required />
            </label>

            <label>
              KM
              <input v-model="updateForm.km" type="number" min="0" step="1" inputmode="numeric" placeholder="0" />
            </label>
          </div>

          <label>
            Nomor Surat Jalan
            <input v-model="updateForm.delivery_order_number" type="text" placeholder="SJ-001" />
          </label>

          <label class="upload-box">
            <span>Upload Surat Jalan</span>
            <input type="file" accept="image/*,.pdf" @change="fileToBase64" />
            <strong>{{ updateForm.delivery_order_filename || 'Pilih foto/PDF surat jalan' }}</strong>
          </label>

          <label>
            Catatan Sopir
            <textarea v-model="updateForm.note" rows="4" placeholder="Catatan operasional, kendala, atau instruksi tambahan" />
          </label>

          <label class="confirm-row">
            <input v-model="updateForm.confirm" type="checkbox" />
            <span>Konfirmasi booking setelah disimpan</span>
          </label>

          <button class="primary-button sticky-submit" type="submit" :disabled="saving">
            {{ saving ? 'Menyimpan...' : updateForm.confirm ? 'Update & Konfirmasi' : 'Simpan Draft' }}
          </button>
        </form>
      </template>
    </section>
  </main>
</template>
