/* Barcode selection rules.
 *
 * IMPORTANT: this file contains LOGIC only — no real barcode prefixes or
 * series labels are baked in. The data lives in a config object loaded at
 * startup (see config/barcode-config.sample.json and MushikingPanel.jsx).
 * Until configureBarcodes() is called, the rules are empty and selection
 * falls back to the first available barcode on a card.
 */

let CFG = {
  /* Source label that should always be preferred first, if present. */
  priority_source: null,
  /* version/medal tag -> list of barcode `source` labels to look for. */
  series_to_sources: {},
  /* Ordered list of CODE39 template prefixes to try as a last resort. */
  fallback_prefixes: [],
};

/**
 * Install the barcode selection rules (call once at startup).
 * @param {object} cfg parsed barcode-config.json
 */
export function configureBarcodes(cfg) {
  CFG = {
    priority_source: cfg?.priority_source ?? null,
    series_to_sources: cfg?.series_to_sources ?? {},
    fallback_prefixes: Array.isArray(cfg?.fallback_prefixes) ? cfg.fallback_prefixes : [],
  };
}

function pickByPrefixes(barcodes) {
  if (CFG.priority_source) {
    const pref = barcodes.find((b) => b.source === CFG.priority_source);
    if (pref?.template) return pref;
  }
  for (const prefix of CFG.fallback_prefixes) {
    const hit = barcodes.find((b) => b.template?.startsWith(prefix));
    if (hit?.template) return hit;
  }
  return barcodes[0]?.template ? barcodes[0] : null;
}

/**
 * Pick the barcode entry most appropriate for the given series tag.
 *
 * @param {object|null|undefined} card cards.json mushi/waza/license entry
 * @param {string} [series] versions key (e.g. NT/T/DS); '' / null for default
 * @returns {object|null}
 */
export function preferredBarcodeEntry(card, series) {
  const barcodes = card?.barcodes || [];
  if (!barcodes.length) return null;

  if (series) {
    const sources = CFG.series_to_sources[series];
    if (sources) {
      for (const src of sources) {
        const hit = barcodes.find((b) => (
          b.source === src
          && b.template
          && (b.battle_profiles || []).some((p) => p.series === series)
        ));
        if (hit) return hit;
      }
      for (const src of sources) {
        const hit = barcodes.find((b) => b.source === src && b.template);
        if (hit) return hit;
      }
    }
  }

  return pickByPrefixes(barcodes);
}

/**
 * Pick the CODE39 template most appropriate for the given series tag.
 *
 * @param {object|null|undefined} card cards.json mushi/waza/license entry
 * @param {string} [series] versions key (e.g. NT/T/DS); '' / null for default
 * @returns {string|null}
 */
export function preferredBarcode(card, series) {
  return preferredBarcodeEntry(card, series)?.template || null;
}
