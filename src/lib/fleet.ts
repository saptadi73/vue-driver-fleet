type JsonObject = Record<string, unknown>

export function formatScheduleDateTime(value?: string, timeZone?: string): string {
  if (!value) return 'Belum ditentukan admin'
  const utc = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(utc)
  if (Number.isNaN(date.getTime())) return 'Waktu tidak valid'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone, timeZoneName: 'short',
  }).format(date)
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function unwrapFleetResponse<T>(body: unknown): T {
  if (!isObject(body)) throw new Error('Respons server tidak valid.')
  if (body.error) {
    const error = isObject(body.error) ? body.error : {}
    const details = isObject(error.data) ? error.data : {}
    throw new Error(String(details.message || error.message || 'Request gagal diproses.'))
  }
  const result = body.result ?? body
  if (!isObject(result)) throw new Error('Respons server tidak valid.')
  if (result.status === 'error') throw new Error(String(result.message || 'Request gagal diproses.'))
  return (result.status === 'success' ? result.data : result) as T
}

export type FleetGroupBooking = {
  id: number
  trip_date?: string
  departure_datetime?: string
  booking_date?: string
  date?: string
  date_order?: string
  scheduled_date?: string
  vehicle_locked?: boolean
  vehicle_id?: { id: number; name: string }
  vehicle?: { id: number; name: string; license_plate?: string }
}

export function bookingDate(booking: FleetGroupBooking): string {
  return booking.trip_date || booking.departure_datetime || booking.booking_date ||
    booking.date || booking.date_order || booking.scheduled_date || ''
}

export function isVehicleLocked(booking: FleetGroupBooking | null): boolean {
  return Boolean(booking && (booking.vehicle_locked || booking.vehicle_id?.id || booking.vehicle?.id))
}

export function groupFleetBookings<T extends FleetGroupBooking>(bookings: T[]) {
  const groups = new Map<string, { key: string; date: string; vehicle: string; bookings: T[] }>()
  for (const booking of bookings) {
    const date = bookingDate(booking).slice(0, 10)
    const vehicleId = booking.vehicle_id?.id || booking.vehicle?.id || 0
    const key = `${date}:${vehicleId}`
    let group = groups.get(key)
    if (!group) {
      group = { key, date, vehicle: booking.vehicle?.license_plate || booking.vehicle_id?.name ||
        booking.vehicle?.name || 'Armada belum ditentukan', bookings: [] }
      groups.set(key, group)
    }
    group.bookings.push(booking)
  }
  return [...groups.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.vehicle.localeCompare(b.vehicle) || a.key.localeCompare(b.key))
    .map((group) => ({ ...group, bookings: [...group.bookings].sort((a, b) =>
      (a.departure_datetime || '').localeCompare(b.departure_datetime || '') || a.id - b.id) }))
}

export type DriverUpdateForm = {
  vehicle_id: string; product_id: string; quantity: string; km: string
  delivery_order_number: string; delivery_order_filename: string; delivery_order_file: string
  note: string; confirm: boolean
}

export function buildDriverUpdatePayload(booking: FleetGroupBooking, form: DriverUpdateForm): JsonObject {
  const payload: JsonObject = {
    booking_id: booking.id, product_id: Number(form.product_id), quantity: Number(form.quantity || 0),
    km: Number(form.km || 0), delivery_order_number: form.delivery_order_number,
    note: form.note, confirm: form.confirm,
  }
  if (!isVehicleLocked(booking)) payload.vehicle_id = Number(form.vehicle_id)
  if (form.delivery_order_file) {
    payload.delivery_order_file = form.delivery_order_file
    payload.delivery_order_filename = form.delivery_order_filename
  }
  return payload
}
