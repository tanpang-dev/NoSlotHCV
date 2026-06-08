'use strict';

/* Plain-node tests (no framework). Run: node server/lib/keybaker.test.js */

const assert = require('assert');
const { computePmk, findSlot, bake, MAGIC, SLOT } = require('./keybaker');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

/* IEEE 802.11i / wpa_passphrase standard test vector. */
test('computePmk matches the standard WPA test vector (IEEE/password)', () => {
  const pmk = computePmk('IEEE', 'password').toString('hex');
  assert.strictEqual(pmk, 'f42c6fc52df0ebef9ebb4b90b38a5f902e83fe1b135a70e23aed762e9710a12e');
});

test('computePmk rejects bad SSID/PSK lengths', () => {
  assert.throws(() => computePmk('', 'password'), /SSID/);
  assert.throws(() => computePmk('x'.repeat(33), 'password'), /SSID/);
  assert.throws(() => computePmk('IEEE', 'short'), /passphrase/);
});

test('bake writes ssid + pmk into the slot and leaves the rest intact', () => {
  // Build a fake blob: filler + slot (magic prefilled) + filler.
  const pre = Buffer.alloc(100, 0xaa);
  const slot = Buffer.alloc(SLOT.size, 0x00);
  MAGIC.copy(slot, SLOT.magic);
  const post = Buffer.alloc(50, 0xbb);
  const blob = Buffer.concat([pre, slot, post]);

  const off = findSlot(blob);
  assert.strictEqual(off, 100);

  const out = bake(blob, 'IEEE', 'password');

  // source not mutated
  assert.ok(blob.equals(Buffer.concat([pre, slot, post])));
  // surrounding bytes untouched
  assert.ok(out.subarray(0, 100).equals(pre));
  assert.ok(out.subarray(100 + SLOT.size).equals(post));
  // slot fields
  assert.strictEqual(out[off + SLOT.version], 1);
  assert.strictEqual(out[off + SLOT.ssidLen], 4);
  assert.strictEqual(out.toString('ascii', off + SLOT.ssid, off + SLOT.ssid + 4), 'IEEE');
  assert.strictEqual(
    out.toString('hex', off + SLOT.pmk, off + SLOT.pmk + 32),
    'f42c6fc52df0ebef9ebb4b90b38a5f902e83fe1b135a70e23aed762e9710a12e',
  );
});

test('bake throws when the magic is absent', () => {
  assert.throws(() => bake(Buffer.alloc(200, 0), 'IEEE', 'password'), /magic not found/);
});

console.log(`\nkeybaker: ${passed} tests passed`);
