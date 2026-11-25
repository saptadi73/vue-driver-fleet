<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppCard from './components/AppCard.vue'
import AppDataTable from './components/AppDataTable.vue'
import AppModal from './components/AppModal.vue'
import { bookingDate, buildDriverUpdatePayload, formatScheduleDateTime, groupFleetBookings, isVehicleLocked, unwrapFleetResponse } from './lib/fleet'

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
  trip_number?: string
  state?: string
  date?: string
  booking_date?: string
  trip_date?: string
  departure_datetime?: string
  arrival_datetime?: string
  departure_region_id?: OptionRef
  destination_region_id?: OptionRef
  vehicle_locked?: boolean
  delivery_order_filename?: string
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

const productionBackendUrl = 'https://siskab.kanjabung.com'

const loginForm = reactive({
  host: localStorage.getItem('driverFleetHost') || productionBackendUrl,
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
  confirm: false,
})

const bookings = ref<Booking[]>([])
const vehicles = ref<Vehicle[]>([])
const products = ref<Product[]>([])
const selectedBooking = ref<Booking | null>(null)
const auth = ref<LoginResponse | null>(null)
const dateFilter = ref('')
const loading = ref(false)
const saving = ref(false)
const loginLoading = ref(false)
const bookingModalOpen = ref(false)
const error = ref('')
const success = ref('')
const activeView = ref<'login' | 'list'>('login')

const driverName = computed(
  () =>
    auth.value?.driver?.name || auth.value?.employee?.name || auth.value?.user?.name || 'Driver',
)

const filteredBookings = computed(() => {
  return bookings.value.filter((booking) => {
    const matchesDate =
      !dateFilter.value || normalizeDate(getBookingDate(booking)) === dateFilter.value
    return matchesDate
  })
})

const bookingColumns = [
  { key: 'trip_number', label: 'No. Trip/Leg' },
  { key: 'name', label: 'Booking' },
  { key: 'date', label: 'Tanggal' },
  { key: 'departure', label: 'Berangkat' },
  { key: 'origin', label: 'Asal' },
  { key: 'destination', label: 'Tujuan' },
  { key: 'product', label: 'Produk' },
  { key: 'quantity', label: 'Qty' },
  { key: 'vehicle', label: 'Armada' },
  { key: 'state', label: 'Status' },
  { key: 'action', label: '' },
]

const tableRows = computed(() =>
  groupFleetBookings(filteredBookings.value).flatMap((group) => group.bookings.map((booking) => ({
    id: booking.id,
    trip_number: booking.trip_number || booking.name,
    trip_group: `${group.vehicle} · ${displayDate(group.date)} · ${group.bookings.length} trip`,
    name: booking.name,
    date: displayDate(getBookingDate(booking)),
    departure: displayDeparture(booking.departure_datetime),
    origin: booking.departure_region_id?.name || 'Asal belum diisi',
    destination: booking.destination_region_id?.name || booking.destination || booking.destination_id?.name || 'Tujuan belum diisi',
    product: booking.product_id?.name || '-',
    quantity: moneylessNumber(booking.quantity),
    vehicle: booking.vehicle_id?.name || booking.vehicle?.license_plate || '-',
    state: booking.state || 'draft',
  }))),
)
const vehicleLocked = computed(() => isVehicleLocked(selectedBooking.value))

async function rpc<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ params }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      data.error?.data?.message || data.error?.message || data.message || 'Request gagal diproses.'
    throw new Error(message)
  }

  return unwrapFleetResponse<T>(data)
}

function buildApiUrl(path: string) {
  const host = loginForm.host.trim().replace(/\/+$/, '')
  return host ? `${host}${path}` : path
}

function getBookingDate(booking: Booking) {
  return bookingDate(booking)
}

function displayDeparture(value?: string) {
  if (!value) return '-'
  const utc = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(utc)
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit',
  }).format(date)
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
    const collected = new Map<number, Booking>()
    let page = 1
    while (true) {
      const result = await rpc<{ bookings?: Booking[]; total?: number }>(
        '/api/fleet/driver/bookings', { page, limit: 100, states: ['draft'] },
      )
      const rows = result.bookings || []
      const previousSize = collected.size
      rows.forEach((booking) => collected.set(booking.id, booking))
      if (!rows.length || collected.size >= (result.total ?? rows.length)) break
      if (collected.size === previousSize) throw new Error('Pagination booking tidak bergerak. Muat ulang daftar.')
      page += 1
    }
    bookings.value = [...collected.values()]
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
    bookingModalOpen.value = true
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
  updateForm.confirm = false
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
    await rpc('/api/fleet/driver/bookings/update', buildDriverUpdatePayload(selectedBooking.value, updateForm))

    success.value = updateForm.confirm
      ? 'Booking berhasil diupdate dan dikonfirmasi.'
      : 'Booking berhasil disimpan.'
    bookingModalOpen.value = false
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
  bookingModalOpen.value = false
  activeView.value = 'login'
}

function clearFilters() {
  dateFilter.value = ''
  void loadBookings()
}

function openBookingFromRow(row: Record<string, unknown>) {
  const booking = filteredBookings.value.find((item) => item.id === row.id)
  if (booking) void openBooking(booking)
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
        <p class="eyebrow">Sopir</p>
        <h1>Masuk ke Odoo Fleet</h1>
        <p class="login-copy">
          Kelola booking draft, lengkapi armada, dan upload surat jalan langsung dari HP.
        </p>

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
          <input
            v-model="loginForm.db"
            type="text"
            autocomplete="organization"
            placeholder="nama_database"
            required
          />
        </label>

        <label>
          Email / Login
          <input
            v-model="loginForm.login"
            type="text"
            autocomplete="username"
            placeholder="driver@example.com"
            required
          />
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
          <span v-if="loginLoading" class="button-spinner" aria-hidden="true"></span>
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

      <p v-if="error && !bookingModalOpen" class="alert error">{{ error }}</p>
      <p v-if="success" class="alert success">{{ success }}</p>

      <template v-if="activeView === 'list'">
        <AppCard class="toolbar">
          <label class="date-box">
            Tanggal trip
            <input v-model="dateFilter" type="date" />
          </label>

          <div class="toolbar-actions">
            <button
              class="secondary-button"
              type="button"
              :disabled="loading"
              @click="loadBookings"
            >
              <span v-if="loading" class="button-spinner" aria-hidden="true"></span>
              {{ loading ? 'Memuat...' : 'Refresh' }}
            </button>
            <button class="plain-button" type="button" @click="clearFilters">Reset tanggal</button>
          </div>
        </AppCard>

        <section class="summary-strip" aria-live="polite">
          <AppCard class="summary-card">
            <span class="summary-icon" aria-hidden="true">↗</span>
            <div>
              <strong>{{ loading ? '—' : filteredBookings.length }}</strong>
              <span>Draft tersedia</span>
            </div>
          </AppCard>
          <AppCard class="summary-card summary-card-muted">
            <span class="summary-icon" aria-hidden="true">◎</span>
            <div>
              <strong>{{ dateFilter ? displayDate(dateFilter) : 'Semua tanggal' }}</strong>
              <span>Filter tanggal</span>
            </div>
          </AppCard>
        </section>

        <AppCard class="table-card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Daftar operasional</p>
              <h2>Booking aktif</h2>
            </div>
            <span class="table-hint">Pilih booking untuk memperbarui detail</span>
          </div>
          <AppDataTable
            :columns="bookingColumns"
            :rows="tableRows"
            :loading="loading"
            group-by="trip_group"
            search-placeholder="Cari nomor, tujuan, produk..."
          >
            <template #cell-name="{ row }">
              <strong class="booking-number">{{ row.name }}</strong>
            </template>
            <template #cell-state="{ row }">
              <span class="status-pill">{{ row.state }}</span>
            </template>
            <template #cell-action="{ row }">
              <button
                class="table-action"
                type="button"
                :disabled="loading"
                @click="openBookingFromRow(row)"
              >
                Perbarui
              </button>
            </template>
          </AppDataTable>
        </AppCard>
      </template>

      <AppModal
        v-if="selectedBooking"
        v-model="bookingModalOpen"
        :title="`Perbarui ${selectedBooking.name}`"
      >
        <div class="booking-hero">
          <span class="status-pill">{{ selectedBooking.state || 'draft' }}</span>
          <h1>{{ selectedBooking.name }}</h1>
          <p>{{ selectedBooking.trip_number || selectedBooking.name }}</p>
          <p>
            {{
              selectedBooking.destination_region_id?.name || selectedBooking.destination ||
              selectedBooking.destination_id?.name ||
              'Tujuan belum diisi'
            }}
          </p>
          <div class="hero-meta">
            <span>{{ displayDate(getBookingDate(selectedBooking)) }}</span>
            <span>{{ selectedBooking.product_id?.name || 'Produk belum dipilih' }}</span>
          </div>
        </div>

        <p v-if="error" class="alert error">{{ error }}</p>
        <form class="update-form" @submit.prevent="submitBooking">
          <div class="form-grid">
            <label>Wilayah asal<input :value="selectedBooking.departure_region_id?.name || 'Belum diisi admin'" readonly /></label>
            <label>Wilayah tujuan<input :value="selectedBooking.destination_region_id?.name || 'Belum diisi admin'" readonly /></label>
          </div>
          <p class="table-hint">Rute ditentukan oleh admin. Berangkat: {{ formatScheduleDateTime(selectedBooking.departure_datetime) }}.
            Estimasi selesai: {{ formatScheduleDateTime(selectedBooking.arrival_datetime) }}.</p>
          <label>
            Armada
            <input v-if="vehicleLocked" :value="selectedBooking.vehicle?.license_plate || selectedBooking.vehicle_id?.name || selectedBooking.vehicle?.name" readonly />
            <select v-else v-model="updateForm.vehicle_id" required>
              <option value="" disabled>Pilih armada</option>
              <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
                {{ vehicle.license_plate || vehicle.name }} -
                {{ vehicle.model_id?.name || vehicle.brand_id?.name || 'Fleet' }}
              </option>
            </select>
            <small v-if="vehicleLocked">Armada ditetapkan admin dan tidak dapat diganti.</small>
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
              <input
                v-model="updateForm.quantity"
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
                required
              />
            </label>

            <label>
              KM
              <input
                v-model="updateForm.km"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                placeholder="0"
              />
            </label>
          </div>

          <label>
            Nomor Surat Jalan
            <input v-model="updateForm.delivery_order_number" type="text" placeholder="SJ-001" />
          </label>

          <label class="upload-box">
            <span>Upload Surat Jalan</span>
            <input type="file" accept="image/*,.pdf" @change="fileToBase64" />
            <strong>{{
              updateForm.delivery_order_filename || 'Pilih foto/PDF surat jalan'
            }}</strong>
            <small v-if="selectedBooking.delivery_order_filename">Tersimpan: {{ selectedBooking.delivery_order_filename }}</small>
          </label>

          <label>
            Catatan Sopir
            <textarea
              v-model="updateForm.note"
              rows="4"
              placeholder="Catatan operasional, kendala, atau instruksi tambahan"
            />
          </label>

          <label class="confirm-row">
            <input v-model="updateForm.confirm" type="checkbox" />
            <span>Konfirmasi booking setelah disimpan</span>
          </label>

          <button class="primary-button sticky-submit" type="submit" :disabled="saving">
            <span v-if="saving" class="button-spinner" aria-hidden="true"></span>
            {{
              saving ? 'Menyimpan...' : updateForm.confirm ? 'Update & Konfirmasi' : 'Simpan Draft'
            }}
          </button>
        </form>
      </AppModal>
    </section>
  </main>
</template>
