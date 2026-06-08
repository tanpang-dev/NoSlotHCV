'use strict';

/*
 * Wi-Fi "key baker".
 *
 * The device blob (MWIFI.BIN) reserves a fixed-layout "creds slot" marked by a
 * magic string. Instead of recompiling the C blob, the user enters their SSID +
 * passphrase here; we compute the WPA PMK on the PC (PBKDF2-HMAC-SHA1, the same
 * derivation a router uses) and patch SSID + PMK into the slot. The device then
 * behaves exactly like a compile-time-embedded build: no runtime PBKDF2, no SD
 * config read during boot — which is what made earlier approaches unstable.
 *
 * Slot layout (must match device/mwifi_creds_slot.h):
 *   offset size field
 *   0      8    magic   "MWIFICR1"
 *   8      1    version (=1)
 *   9      1    ssid_len (0..32)
 *   10     2    reserved
 *   12     32   ssid (raw bytes, ssid_len valid, rest zero)
 *   44     32   pmk  (precomputed)
 *   total: 76 bytes
 */

const crypto = require('crypto');

const MAGIC = Buffer.from('MWIFICR1', 'ascii');
const SLOT = Object.freeze({
  magic: 0,
  version: 8,
  ssidLen: 9,
  reserved: 10,
  ssid: 12,
  pmk: 44,
  size: 76,
});

const SSID_MAX = 32;
const PMK_LEN = 32;

/**
 * Compute the WPA PMK from an SSID + passphrase.
 * PMK = PBKDF2(HMAC-SHA1, passphrase, ssid, 4096, 256 bits).
 * @param {string} ssid 1..32 bytes (UTF-8)
 * @param {string} psk  8..63 ASCII characters
 * @returns {Buffer} 32-byte PMK
 */
function computePmk(ssid, psk) {
  const ssidBuf = Buffer.from(String(ssid), 'utf8');
  if (ssidBuf.length < 1 || ssidBuf.length > SSID_MAX) {
    throw new Error('SSID must be 1..32 bytes');
  }
  if (typeof psk !== 'string' || psk.length < 8 || psk.length > 63) {
    throw new Error('passphrase must be 8..63 characters');
  }
  return crypto.pbkdf2Sync(psk, ssidBuf, 4096, PMK_LEN, 'sha1');
}

/**
 * Find the creds-slot offset in a blob image.
 * @param {Buffer} buf
 * @returns {number} byte offset, or -1 if the magic is not present
 */
function findSlot(buf) {
  return buf.indexOf(MAGIC);
}

/**
 * Return a NEW buffer with SSID + PMK patched into the creds slot.
 * The input buffer is not mutated.
 * @param {Buffer} buf  the prebuilt MWIFI.BIN
 * @param {string} ssid
 * @param {string} psk
 * @returns {Buffer}
 */
function bake(buf, ssid, psk) {
  const off = findSlot(buf);
  if (off < 0) throw new Error('creds-slot magic not found in MWIFI.BIN');
  if (off + SLOT.size > buf.length) throw new Error('creds slot runs past end of file');

  const ssidBuf = Buffer.from(String(ssid), 'utf8');
  if (ssidBuf.length > SSID_MAX) throw new Error('SSID must be <= 32 bytes');
  const pmk = computePmk(ssid, psk);

  const out = Buffer.from(buf); // copy — never mutate the source image
  out[off + SLOT.version] = 1;
  out[off + SLOT.ssidLen] = ssidBuf.length;
  out[off + SLOT.reserved] = 0;
  out[off + SLOT.reserved + 1] = 0;
  out.fill(0, off + SLOT.ssid, off + SLOT.ssid + SSID_MAX);
  ssidBuf.copy(out, off + SLOT.ssid);
  pmk.copy(out, off + SLOT.pmk);
  return out;
}

module.exports = { MAGIC, SLOT, SSID_MAX, PMK_LEN, computePmk, findSlot, bake };
