import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect.jsx';
import { selectCard } from './api.js';
import { preferredBarcode, preferredBarcodeEntry } from './barcode.js';

const BASE = '/mushiking/';
const MISC_SPRITE = `${BASE}ds-misc/MushiKingDSCardsMisc.png`;

const SLOTS = [
  { id: 'mushi',   label: 'メインムシ', source: 'mushi_cards',   color: '#5b8c4a' },
  { id: 'gu',      label: 'グー',       source: 'waza_cards',    color: '#a14545' },
  { id: 'choki',   label: 'チョキ',     source: 'waza_cards',    color: '#caa33a' },
  { id: 'paa',     label: 'パー',       source: 'waza_cards',    color: '#3d6ea8' },
  { id: 'license', label: 'ライセンス', source: 'license_cards', color: '#a07832' },
];

const MOVE_LABELS = { gu: 'グー', choki: 'チョキ', paa: 'パー' };

/* Summon-card barcodes are user-supplied — real CODE39 values are NOT shipped.
 * They are injected at startup via configureSummon(); empty until then. */
const SUMMON_CARDS = [
  { type: 'gu',    label: 'グー',   name: '召喚カード(グー)',   barcode: '', width: 131, backgroundPosition: '0 0' },
  { type: 'choki', label: 'チョキ', name: '召喚カード(チョキ)', barcode: '', width: 130, backgroundPosition: '-261px 0' },
  { type: 'paa',   label: 'パー',   name: '召喚カード(パー)',   barcode: '', width: 130, backgroundPosition: '-131px 0' },
];

/**
 * Install summon-card barcodes (call once at startup).
 * @param {{gu?: string, choki?: string, paa?: string}} cfg
 */
export function configureSummon(cfg) {
  for (const s of SUMMON_CARDS) {
    if (cfg && typeof cfg[s.type] === 'string') s.barcode = cfg[s.type];
  }
}

function toOptions(items) {
  return items.map((c) => ({
    value: c.no || c.name,
    label: c.name + (c.no ? ` (No.${c.no})` : ''),
    sub: preferredBarcode(c) || '',
    card: c,
  }));
}

function itemsForSlot(sourceLookup, slot) {
  const items = sourceLookup[slot.source] || [];
  if (slot.source !== 'waza_cards') return items;
  return items.filter((card) => card?.battle?.move_type === slot.id);
}

function firstImage(card) {
  if (!card?.images || !card.images.length) return null;
  return BASE + card.images[0];
}

/* NT (性格無し) images are scraped from mushiking.com's 2003 N column with
 * fallback to the A column (see work/cards/scrape_nt_a.py). Both mushi and
 * waza dirs are listed so the same series tag works for either card kind —
 * imageForSeries only returns the first hit, and the path prefixes are
 * disjoint per card kind so there's no collision. '2005-03-second' is kept
 * as a legacy fallback for cards that pre-date NT scraping. */
const MEDAL_IMAGE_DIRS = {
  NT: ['2003-nt-mushi', '2003-nt-waza', '2005-03-second'],
  T: [
    '2005-04-second-plus',
    '2006-01-first',
    '2006-02-second',
    '2006-03-summer',
    '2006-04-300m',
    '2006-05-dynamic',
  ],
  CC: ['2007-04-forest-green'],
  TC: ['2007-05-diamond-blue'],
  '07-1': ['2007-01-first'],
  '07-S': ['2007-06-summer-shining'],
  '07-1+': ['2007-02-5th-vol1', '2007-03-5th-vol2'],
  BT: ['2007-01-first'],
  'BT-SP': ['2007-01-first'],
  '03-06': [
    '2005-03-second',
    '2005-04-second-plus',
    '2006-01-first',
    '2006-02-second',
    '2006-03-summer',
    '2006-04-300m',
    '2006-05-dynamic',
  ],
  SP: ['2007-01-first'],
  DS: ['2007-02-5th-vol1', '2007-03-5th-vol2'],
};

function imageForSeries(card, series) {
  if (!card?.images?.length) return null;
  const dirs = MEDAL_IMAGE_DIRS[series] || [];
  for (const dir of dirs) {
    const hit = card.images.find((img) => img.startsWith(`${dir}/`));
    if (hit) return hit;
  }
  return null;
}

function seriesOptions(card) {
  return Object.keys(card?.versions || {});
}

function findCardByValue(items, value) {
  return items.find((c) => (c.no || c.name) === value) || null;
}

function battleForBarcode(barcodeEntry, series) {
  if (!barcodeEntry) return null;
  const profile = (barcodeEntry.battle_profiles || []).find((p) => p.series === series);
  return profile || barcodeEntry.battle || null;
}

function battleInfo(card, slotId, mainMushi, barcodeEntry = null, series = '') {
  const battle = card?.battle;
  const barcodeBattle = battleForBarcode(barcodeEntry, series);
  if (!battle && !barcodeBattle) return null;

  if (slotId === 'mushi') {
    const atk = battle?.attack || {};
    const specialType = barcodeBattle?.special_move_type
      ? MOVE_LABELS[barcodeBattle.special_move_type] || barcodeBattle.special_move_type
      : null;
    const specialMove = barcodeBattle?.special_move || battle?.special_move || '-';
    const confidence = Number.isFinite(barcodeBattle?.confidence)
      ? ` / 推定 ${Math.round(barcodeBattle.confidence * 100)}%`
      : '';
    return {
      main: `必殺: ${specialMove}${specialType ? ` (${specialType})` : ''}${confidence}`,
      sub: `体力 ${battle?.hp ?? '-'} / グー ${atk.gu ?? '-'} / チョキ ${atk.choki ?? '-'} / パー ${atk.paa ?? '-'} / テク ${battle?.technique ?? '-'}`,
    };
  }

  if (slotId === 'license') return null;

  const move = MOVE_LABELS[battle.move_type] || battle.move_type || '-';
  const imageConfidence = Number.isFinite(battle.confidence)
    ? `画像推定 ${Math.round(battle.confidence * 100)}%`
    : '';
  const tech = battle.special
    ? '特殊'
    : Number.isFinite(battle.technique)
      ? `必要テク ${battle.technique}`
      : imageConfidence || '必要テク -';
  const mainTech = mainMushi?.battle?.technique;
  const canUse = !battle.special && Number.isFinite(mainTech) && Number.isFinite(battle.technique)
    ? mainTech >= battle.technique
    : null;
  const isMainSpecial = mainMushi?.battle?.special_move === card.name;
  const verdict =
    canUse === true ? '対応可' :
    canUse === false ? `不足: メイン ${mainTech}` :
    '';

  return {
    main: `${move} / ${tech}${verdict ? ` / ${verdict}` : ''}`,
    sub: isMainSpecial ? 'メインムシの超必殺わざ' : '',
  };
}

export default function MushikingBattle({ db, compact = false }) {
  // slotId -> selected value
  const [picks, setPicks] = useState({});
  const [seriesPicks, setSeriesPicks] = useState({});
  // 「最後にスキャンしたカード」表示用
  const [lastScan, setLastScan] = useState(null);

  useEffect(() => {
    selectCard('', null);
  }, []);

  const sourceLookup = useMemo(() => ({
    mushi_cards:   db.mushi_cards || [],
    waza_cards:    db.waza_cards || [],
    license_cards: db.license_cards || [],
  }), [db]);

  const optionsBySlot = useMemo(() => {
    const out = {};
    for (const s of SLOTS) out[s.id] = toOptions(itemsForSlot(sourceLookup, s));
    return out;
  }, [sourceLookup]);

  const mainMushi = findCardByValue(sourceLookup.mushi_cards, picks.mushi);

  const onScan = async (slot, card, series) => {
    if (!card) return;
    const bc = preferredBarcode(card, series);
    const base = {
      slot: slot.label,
      name: card.name,
      barcode: bc,
      time: new Date().toLocaleTimeString(),
    };
    if (!bc) {
      setLastScan({ ...base, sending: false, ok: false, error: 'バーコード未登録' });
      return;
    }
    setLastScan({ ...base, sending: true });
    const res = await selectCard(bc, card.name);
    setLastScan({ ...base, sending: false, ok: res.ok, error: res.error });
  };

  const onSummonScan = async (summon) => {
    const base = {
      slot: '召喚カード',
      name: summon.name,
      barcode: summon.barcode,
      time: new Date().toLocaleTimeString(),
    };
    setLastScan({ ...base, sending: true });
    const res = await selectCard(summon.barcode, summon.name);
    setLastScan({ ...base, sending: false, ok: res.ok, error: res.error });
  };

  return (
    <div style={st.root}>
      <div style={{ ...st.slotsGrid, ...(compact ? st.slotsGridCompact : {}) }}>
        {SLOTS.map((slot) => {
          const items = itemsForSlot(sourceLookup, slot);
          const value = picks[slot.id];
          const card = findCardByValue(items, value);
          const selectedSeries = card?.versions?.[seriesPicks[slot.id]]
            ? seriesPicks[slot.id]
            : '';
          const selectedImage = selectedSeries
            ? imageForSeries(card, selectedSeries)
            : card?.images?.[0] || null;
          const img = selectedSeries
            ? (selectedImage ? BASE + selectedImage : null)
            : firstImage(card);
          const barcode = preferredBarcode(card, selectedSeries);
          const barcodeEntry = preferredBarcodeEntry(card, selectedSeries);
          const cardSeries = seriesOptions(card);
          const info = battleInfo(card, slot.id, mainMushi, barcodeEntry, selectedSeries);
          return (
            <div key={slot.id} style={{ ...st.slot, ...(compact ? st.slotCompact : {}), borderTopColor: slot.color }}>
              <div style={{ ...st.slotLabel, background: slot.color }}>
                {slot.label}
              </div>
              <div style={{ ...st.slotBody, ...(compact ? st.slotBodyCompact : {}) }}>
                <SearchableSelect
                  options={optionsBySlot[slot.id]}
                  value={value}
                  onChange={(v) => {
                    setPicks((p) => ({ ...p, [slot.id]: v }));
                    setSeriesPicks((p) => ({ ...p, [slot.id]: '' }));
                  }}
                  placeholder={`${slot.label}を検索...`}
                  getKeywords={(o) => [
                    o.label,
                    o.sub,
                    ...((o.card.barcodes || []).map((b) => b.template)),
                  ]}
                />
                {cardSeries.length > 0 && (
                  <select
                    value={selectedSeries}
                    onChange={(e) =>
                      setSeriesPicks((p) => ({ ...p, [slot.id]: e.target.value }))
                    }
                    style={st.seriesSelect}
                    title="表示する弾を選択"
                  >
                    <option value="">先頭画像</option>
                    {cardSeries.map((series) => (
                      <option key={series} value={series}>
                        {series}
                      </option>
                    ))}
                  </select>
                )}
                <div style={{ ...st.cardArea, ...(compact ? st.cardAreaCompact : {}) }}>
                  {img ? (
                    <img src={img} alt={card.name} style={st.cardImg} />
                  ) : (
                    <div style={st.noImg}>
                      {card ? (selectedSeries ? `${selectedSeries}: 画像なし` : '画像なし') : '未選択'}
                    </div>
                  )}
                </div>
                <div style={st.meta}>
                  {card && (
                    <>
                      <div style={st.metaName}>{card.name}</div>
                      {!barcode && (
                        <div style={st.metaBc}>バーコード未登録</div>
                      )}
                      <div style={st.metaBcExtra}>
                        {(card.barcodes || []).length > 1 &&
                          `(他 ${card.barcodes.length - 1} 変異あり)`}
                      </div>
                      {info && (
                        <div style={st.metaBattle}>
                          <div>{info.main}</div>
                          {info.sub && <div style={st.metaBattleSub}>{info.sub}</div>}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  style={{
                    ...st.scanBtn,
                    background: barcode ? slot.color : '#444',
                    cursor: barcode ? 'pointer' : 'not-allowed',
                  }}
                  disabled={!barcode}
                  onClick={() => onScan(slot, card, selectedSeries)}
                >
                  スキャン
                </button>
                {slot.id === 'mushi' && (
                  <div style={st.summonPanel}>
                    <div style={st.summonTitle}>召喚カード</div>
                    <div style={st.summonGrid}>
                      {SUMMON_CARDS.map((summon) => (
                        <button
                          key={summon.type}
                          type="button"
                          onClick={() => onSummonScan(summon)}
                          style={{
                            ...st.summonBtn,
                            borderColor: SLOTS.find((s) => s.id === summon.type)?.color || '#444',
                          }}
                          title={`${summon.name}: ${summon.barcode}`}
                        >
                          <span style={st.summonThumbFrame}>
                            <span
                              style={{
                                ...st.summonThumb,
                                width: summon.width,
                                backgroundImage: `url(${MISC_SPRITE})`,
                                backgroundPosition: summon.backgroundPosition,
                              }}
                            />
                          </span>
                          <span style={st.summonLabel}>{summon.label}</span>
                          <code style={st.summonCode}>{summon.barcode}</code>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {lastScan && (
        <div style={st.lastScan}>
          直近スキャン: <b>{lastScan.slot}</b> / {lastScan.name} ({lastScan.time}){' '}
          {lastScan.sending && <span style={st.scanPending}>送信中…</span>}
          {lastScan.sending === false && lastScan.ok && (
            <span style={st.scanOk}>✓ 送信済</span>
          )}
          {lastScan.sending === false && !lastScan.ok && (
            <span style={st.scanErr}>✗ {lastScan.error || '送信失敗'}</span>
          )}
        </div>
      )}
    </div>
  );
}

const st = {
  root: { padding: '12px 0' },
  slotsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))',
    gap: 12,
  },
  slotsGridCompact: {
    gridTemplateColumns: '1fr',
    gap: 10,
  },
  slot: {
    background: '#1c1c24',
    borderRadius: 6,
    border: '1px solid #333',
    borderTop: '3px solid',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  slotCompact: { borderRadius: 5 },
  slotLabel: {
    padding: '6px 10px',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  slotBody: { padding: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  slotBodyCompact: { gap: 7 },
  cardArea: {
    height: 160,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d0d12',
    borderRadius: 4,
  },
  cardAreaCompact: { height: 130 },
  cardImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  noImg: { color: '#666', fontSize: 12 },
  meta: { minHeight: 76 },
  metaName: { fontSize: 12, fontWeight: 'bold', color: '#e8e8e8' },
  metaBc: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#9ad',
    marginTop: 2,
    wordBreak: 'break-all',
  },
  metaBcExtra: { fontSize: 10, color: '#888', marginTop: 2 },
  metaBattle: {
    marginTop: 5,
    paddingTop: 5,
    borderTop: '1px solid #30303a',
    fontSize: 10,
    color: '#d8d8c8',
    lineHeight: 1.35,
  },
  metaBattleSub: { color: '#f0c85a', marginTop: 2 },
  seriesSelect: {
    padding: '6px 8px',
    border: '1px solid #555',
    borderRadius: 4,
    background: '#111118',
    color: '#e8e8e8',
    fontSize: 12,
  },
  scanBtn: {
    padding: '8px',
    border: 0,
    borderRadius: 4,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  summonPanel: {
    marginTop: 2,
    paddingTop: 8,
    borderTop: '1px solid #30303a',
  },
  summonTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#d8d8d8',
    marginBottom: 6,
  },
  summonGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 6,
  },
  summonBtn: {
    display: 'grid',
    gridTemplateColumns: '38px minmax(38px, auto) 1fr',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    minHeight: 54,
    padding: 5,
    border: '1px solid',
    borderRadius: 4,
    background: '#111118',
    color: '#e8e8e8',
    textAlign: 'left',
    cursor: 'pointer',
  },
  summonThumbFrame: {
    width: 34,
    height: 48,
    overflow: 'hidden',
    background: '#050509',
    borderRadius: 3,
    display: 'block',
  },
  summonThumb: {
    display: 'block',
    height: 184,
    backgroundRepeat: 'no-repeat',
    transform: 'scale(0.261)',
    transformOrigin: 'top left',
  },
  summonLabel: { fontSize: 11, fontWeight: 'bold' },
  summonCode: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#9ad',
    wordBreak: 'break-all',
  },
  lastScan: {
    marginTop: 16,
    padding: 10,
    background: '#1c1c24',
    borderRadius: 4,
    color: '#cfc',
    fontSize: 12,
  },
  scanPending: { color: '#cc4', marginLeft: 4 },
  scanOk: { color: '#6c6', marginLeft: 4 },
  scanErr: { color: '#e66', marginLeft: 4 },
};
