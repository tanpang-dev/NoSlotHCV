/* Medal/series -> image-directory mapping.
 *
 * Which image folders to look in for a given collector-medal tag is data, not
 * code, so it lives in a config object (config/medal-image-dirs.json) loaded at
 * startup. Until configured, the map is empty and the UI just shows a card's
 * first image. This module is shared by the Zukan and Battle views so the
 * mapping is defined in exactly one place.
 */

let DIRS = {};

/**
 * Install the medal -> image-dir mapping (call once at startup).
 * @param {Record<string, string[]>} cfg
 */
export function configureMedalDirs(cfg) {
  DIRS = cfg && typeof cfg === 'object' ? cfg : {};
}

function matchDir(card, medal) {
  const dirs = DIRS[medal] || [];
  for (const dir of dirs) {
    const hit = (card.images || []).find((img) => img.startsWith(`${dir}/`));
    if (hit) return hit;
  }
  return null;
}

/** Zukan behaviour: fall back to the first image when no medal dir matches. */
export function imageForMedal(card, medal) {
  if (!card?.images?.length) return null;
  return matchDir(card, medal) || card.images[0];
}

/** Battle behaviour: return null when no medal dir matches. */
export function imageForSeries(card, series) {
  if (!card?.images?.length) return null;
  return matchDir(card, series);
}
