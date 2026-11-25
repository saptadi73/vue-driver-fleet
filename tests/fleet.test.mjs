import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/fleet.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText
const { unwrapFleetResponse, bookingDate, groupFleetBookings, buildDriverUpdatePayload, formatScheduleDateTime } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('UTC schedules retain date boundaries and show the local timezone', () => {
  const local = formatScheduleDateTime('2035-01-01T23:00:00', 'Asia/Jakarta')
  assert.match(local, /02 Jan 2035/)
  assert.match(local, /06[.:]00/)
  assert.equal(formatScheduleDateTime(), 'Belum ditentukan admin')
  assert.equal(formatScheduleDateTime('invalid'), 'Waktu tidak valid')
})

test('JSON-RPC success is unwrapped and business errors never become successful saves', () => {
  assert.deepEqual(unwrapFleetResponse({ result: { status: 'success', data: { bookings: [] } } }), { bookings: [] })
  assert.throws(() => unwrapFleetResponse({ result: { status: 'error', message: 'Forbidden' } }), /Forbidden/)
  assert.throws(() => unwrapFleetResponse({ error: { data: { message: 'Session expired' } } }), /Session expired/)
})

test('assigned vehicle and existing attachment are omitted from operational updates', () => {
  const form = { vehicle_id: '99', product_id: '3', quantity: '2', km: '40',
    delivery_order_number: '', delivery_order_filename: 'old.pdf', delivery_order_file: '', note: '', confirm: false }
  const payload = buildDriverUpdatePayload({ id: 7, vehicle_id: { id: 2, name: 'Truck' } }, form)
  assert.equal(payload.booking_id, 7)
  assert.equal(payload.confirm, false)
  assert.equal(payload.note, '')
  assert.equal(payload.delivery_order_number, '')
  assert.equal('vehicle_id' in payload, false)
  assert.equal('delivery_order_file' in payload, false)
  const upload = buildDriverUpdatePayload({ id: 8 }, { ...form, confirm: true, delivery_order_file: 'aGVsbG8=' })
  assert.equal(upload.vehicle_id, 99)
  assert.equal(upload.delivery_order_file, 'aGVsbG8=')
  assert.equal(upload.confirm, true)
})

test('trip grouping preserves separate booking identities and uses trip date', () => {
  const vehicle_id = { id: 1, name: 'Truck' }
  const rows = [
    { id: 2, vehicle_id, trip_date: '2026-11-25', booking_date: '2026-11-01', departure_datetime: '2026-11-25 11:00:00' },
    { id: 1, vehicle_id, trip_date: '2026-11-25', departure_datetime: '2026-11-25 06:00:00' },
    { id: 3, vehicle_id, trip_date: '2026-11-26' },
  ]
  assert.equal(bookingDate(rows[0]), '2026-11-25')
  const groups = groupFleetBookings(rows)
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].bookings.map(row => row.id), [1, 2])
  assert.deepEqual(groups[1].bookings.map(row => row.id), [3])
  assert.deepEqual(rows.map(row => row.id), [2, 1, 3])
})
