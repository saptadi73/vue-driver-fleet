const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: process.env.FLEET_UAT_CHANNEL || 'chrome', headless: true });
  try {
    const context = await browser.newContext({ timezoneId: 'Asia/Jakarta', viewport: { width: 1365, height: 900 } });
    const page = await context.newPage();
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    let authenticated = false, rejectUpdate = false;
    const submissions = [];
    const booking = {
      id: 1, name: 'FBK/UAT/1', trip_number: 'TRIP/00000001', state: 'draft',
      trip_date: '2035-01-01', departure_datetime: '2035-01-01T06:00:00', arrival_datetime: '2035-01-01T10:00:00',
      vehicle_id: { id: 10, name: 'UAT-TRUCK' }, vehicle: { id: 10, license_plate: 'UAT-TRUCK' }, vehicle_locked: true,
      departure_region_id: { id: 2, name: 'Origin UAT' }, destination_region_id: { id: 3, name: 'Destination UAT' },
      product_id: { id: 4, name: 'UAT Product' }, quantity: 1, km: 0, delivery_order_filename: 'old.pdf',
    };
    const auth = { user: { id: 1, name: 'UAT Driver' }, driver: { id: 1, name: 'UAT Driver' } };
    await page.route('**/api/fleet/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const payload = route.request().postDataJSON()?.params || {};
      let result;
      if (path.endsWith('/authenticate')) { authenticated = true; result = { status: 'success', data: auth }; }
      else if (path.endsWith('/context')) result = authenticated ? { status: 'success', data: auth } : { status: 'error', message: 'Login required' };
      else if (path.endsWith('/dropdowns')) result = { status: 'success', data: { vehicles: [], products: [{ id: 4, name: 'UAT Product' }] } };
      else if (path.endsWith('/get')) result = { status: 'success', data: { booking } };
      else if (path.endsWith('/update')) {
        submissions.push(payload);
        if (rejectUpdate) result = { status: 'error', message: 'UAT overlap rejected' };
        else {
          Object.assign(booking, { quantity: payload.quantity, km: payload.km, note: payload.note, confirm: payload.confirm });
          result = { status: 'success', data: { booking } };
        }
      } else result = { status: 'success', data: { bookings: booking.confirm ? [] : [booking], total: booking.confirm ? 0 : 1 } };
      await route.fulfill({ json: { jsonrpc: '2.0', id: 1, result } });
    });
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('Odoo Host URL').fill('http://127.0.0.1:5174');
    await page.getByLabel('Database', { exact: true }).fill('uat-mock');
    await page.getByLabel('Email / Login').fill('uat');
    await page.getByLabel('Password', { exact: true }).fill('uat');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByRole('cell', { name: 'TRIP/00000001', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Perbarui', exact: true }).click();
    assert.equal(await page.getByLabel('Wilayah asal', { exact: true }).getAttribute('readonly'), '');
    assert.equal(await page.getByRole('textbox', { name: /^Armada/ }).getAttribute('readonly'), '');
    assert.equal(await page.getByRole('checkbox').isChecked(), false);
    await page.getByLabel('Catatan Sopir').fill('Draft UAT');
    await page.getByRole('button', { name: 'Simpan Draft', exact: true }).click();
    await page.getByText('Booking berhasil disimpan.', { exact: true }).waitFor();
    assert.equal(submissions[0].confirm, false);
    assert.equal('vehicle_id' in submissions[0], false);
    assert.equal('delivery_order_file' in submissions[0], false);
    await page.getByRole('button', { name: 'Perbarui', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'uat.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 UAT') });
    await page.getByText('uat.pdf', { exact: true }).waitFor();
    rejectUpdate = true;
    await page.getByRole('button', { name: 'Simpan Draft', exact: true }).click();
    await page.locator('.modal-panel').getByText('UAT overlap rejected', { exact: true }).waitFor();
    rejectUpdate = false;
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Update & Konfirmasi', exact: true }).click();
    await page.getByText('Booking berhasil diupdate dan dikonfirmasi.', { exact: true }).waitFor();
    assert.equal(submissions.at(-1).confirm, true);
    assert.match(submissions.at(-1).delivery_order_file, /^data:application\/pdf;base64,/);
    assert.equal(submissions.at(-1).delivery_order_filename, 'uat.pdf');
    assert.deepEqual(failures, []);
    await page.screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'fleet-browser-uat.png'), fullPage: true });
    console.log('PASS: Chrome login, stable trip display, route/vehicle lock, draft save, attachment preservation/upload, business error, confirmation (mock API).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
