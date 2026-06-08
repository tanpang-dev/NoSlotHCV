// Mushiking HCV-1000 card-feed API client.
// The selected card is POSTed to the GBA-to-PC server; the 3DS WiFi feed
// (Phase 2) polls it back via GET /mushiking/current-card.

/**
 * Sends the chosen card's CODE39 to the server as the active card.
 * @param {string} code39 CODE39 barcode template (<=13 chars), '' to clear.
 * @param {string} [name] Human-readable card name (for logs/UI).
 * @returns {Promise<{ ok: boolean, card?: object, error?: string }>}
 */
export async function selectCard(code39, name) {
  try {
    const res = await fetch('/mushiking/select-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code39: code39 || '', name: name || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, card: data.card };
  } catch (err) {
    return { ok: false, error: err.message || 'network error' };
  }
}
