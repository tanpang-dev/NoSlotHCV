import { useMemo, useState } from 'react';
import { selectCard } from './api.js';
import { preferredBarcode, preferredBarcodeEntry } from './barcode.js';

const BASE = '/mushiking/';

const KINDS = [
  { id: 'mushi',   label: 'ムシ',       key: 'mushi_cards' },
  { id: 'waza',    label: 'わざ',       key: 'waza_cards' },
  { id: 'ada',     label: 'アダー',     key: 'ada_cards' },
  { id: 'license', label: 'ライセンス', key: 'license_cards' },
];

const MOVE_FILTERS = [
  { id: '', label: '全わざ' },
  { id: 'gu', label: 'グー' },
  { id: 'choki', label: 'チョキ' },
  { id: 'paa', label: 'パー' },
];

const MOVE_LABELS = { gu: 'グー', choki: 'チョキ', paa: 'パー' };

/* See MushikingBattle.jsx for the rationale. Kept in sync by hand for now. */
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

function imageForMedal(card, medal) {
  if (!card?.images?.length) return null;
  const dirs = MEDAL_IMAGE_DIRS[medal] || [];
  for (const dir of dirs) {
    const hit = card.images.find((img) => img.startsWith(`${dir}/`));
    if (hit) return hit;
  }
  return card.images[0];
}

function battleForBarcode(barcodeEntry, medal) {
  if (!barcodeEntry) return null;
  const profile = (barcodeEntry.battle_profiles || []).find((p) => p.series === medal);
  return profile || barcodeEntry.battle || null;
}

export default function MushikingZukan({ db, compact = false }) {
  const [kind, setKind] = useState('mushi');
  const [query, setQuery] = useState('');
  const [medal, setMedal] = useState('');
  const [moveType, setMoveType] = useState('');
  const [lastScan, setLastScan] = useState(null);

  const allMedals = useMemo(() => db.collector_medals || [], [db]);

  const items = useMemo(() => {
    const list = db[KINDS.find((k) => k.id === kind).key] || [];
    const q = query.trim().toLowerCase();
    return list.filter((c) => {
      if (q) {
        const txt = `${c.no || ''} ${c.name || ''} ${(c.barcodes || [])
          .map((b) => b.template)
          .join(' ')}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      if (medal) {
        if (!c.versions || !c.versions[medal]) return false;
      }
      if (kind === 'waza' && moveType) {
        if (c.battle?.move_type !== moveType) return false;
      }
      return true;
    });
  }, [db, kind, query, medal, moveType]);

  const onScan = async (card) => {
    const bc = preferredBarcode(card, medal);
    if (!bc) return;
    const base = {
      kind: KINDS.find((k) => k.id === kind).label,
      name: card.name,
      no: card.no,
      barcode: bc,
      time: new Date().toLocaleTimeString(),
    };
    setLastScan({ ...base, sending: true });
    const res = await selectCard(bc, card.name);
    setLastScan({ ...base, sending: false, ok: res.ok, error: res.error });
  };

  return (
    <div style={st.root}>
      <div style={{ ...st.controls, ...(compact ? st.controlsCompact : {}) }}>
        <div style={{ ...st.kindTabs, ...(compact ? st.kindTabsCompact : {}) }}>
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => {
                setKind(k.id);
                setMedal('');
                setQuery('');
              }}
              style={{
                ...st.kindBtn,
                ...(compact ? st.kindBtnCompact : {}),
                ...(kind === k.id ? st.kindBtnActive : {}),
              }}
            >
              {k.label}
              <span style={st.kindCount}>
                ({(db[k.key] || []).length})
              </span>
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="名前 / No. / バーコード で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...st.search, ...(compact ? st.fullWidthControl : {}) }}
        />
        <select
          value={medal}
          onChange={(e) => setMedal(e.target.value)}
          style={{ ...st.medalSelect, ...(compact ? st.fullWidthControl : {}) }}
          title="コレクターズメダルで絞り込み"
        >
          <option value="">全メダル</option>
          {allMedals.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} — {m.version}
            </option>
          ))}
        </select>
        {kind === 'waza' && (
          <div style={{ ...st.moveTabs, ...(compact ? st.moveTabsCompact : {}) }}>
            {MOVE_FILTERS.map((m) => (
              <button
                key={m.id || 'all'}
                type="button"
                onClick={() => setMoveType(m.id)}
                style={{
                  ...st.moveBtn,
                  ...(m.id ? st[`moveBtn_${m.id}`] : {}),
                  ...(moveType === m.id ? st.moveBtnActive : {}),
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
        <span style={{ ...st.stats, ...(compact ? st.statsCompact : {}) }}>
          {items.length} 件
        </span>
      </div>

      {lastScan && (
        <div style={st.lastScan}>
          直近スキャン: <b>{lastScan.kind}</b> /{' '}
          {lastScan.no && <code style={st.lastScanNo}>{lastScan.no}</code>}{' '}
          {lastScan.name} ({lastScan.time}){' '}
          {lastScan.sending && <span style={st.scanPending}>送信中…</span>}
          {lastScan.sending === false && lastScan.ok && (
            <span style={st.scanOk}>✓ 送信済</span>
          )}
          {lastScan.sending === false && !lastScan.ok && (
            <span style={st.scanErr}>✗ {lastScan.error || '送信失敗'}</span>
          )}
        </div>
      )}

      <div style={{ ...st.body, ...(compact ? st.bodyCompact : {}) }}>
        <div style={{ ...st.grid, ...(compact ? st.gridCompact : {}) }}>
          {items.map((c) => {
            const imagePath = imageForMedal(c, medal);
            const img = imagePath ? BASE + imagePath : null;
            const barcode = preferredBarcode(c, medal);
            const barcodeEntry = preferredBarcodeEntry(c, medal);
            const hasBc = Boolean(barcode);
            const barcodeBattle = battleForBarcode(barcodeEntry, medal);
            const specialType = barcodeBattle?.special_move_type;
            const specialMove = barcodeBattle?.special_move || c.battle?.special_move;
            return (
              <button
                type="button"
                key={(c.no || '') + ':' + c.name}
                style={{
                  ...st.card,
                  ...(hasBc ? {} : st.cardDisabled),
                }}
                onClick={() => hasBc && onScan(c)}
                disabled={!hasBc}
                title={hasBc ? `スキャン: ${barcode}` : 'バーコード未登録'}
              >
                <div style={{ ...st.cardImgBox, ...(compact ? st.cardImgBoxCompact : {}) }}>
                  {img ? (
                    <img src={img} alt={c.name} style={st.cardImg} />
                  ) : (
                    <div style={st.cardNoImg}>画像なし</div>
                  )}
                </div>
                <div style={st.cardNo}>{c.no || '-'}</div>
                <div style={st.cardName}>{c.name}</div>
                {kind === 'waza' && c.battle?.move_type && (
                  <div style={st.cardMove}>
                    {MOVE_LABELS[c.battle.move_type] || c.battle.move_type}
                  </div>
                )}
                {kind === 'mushi' && specialType && (
                  <div style={st.cardMove}>
                    必殺 {MOVE_LABELS[specialType] || specialType}
                  </div>
                )}
                {kind === 'mushi' && specialMove && (
                  <div style={st.cardSpecial}>
                    {specialMove}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const st = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', gap: 8 },
  controls: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  controlsCompact: { alignItems: 'stretch' },
  kindTabs: { display: 'flex', gap: 4 },
  kindTabsCompact: { width: '100%', overflowX: 'auto', paddingBottom: 2 },
  kindBtn: {
    padding: '6px 12px',
    border: '1px solid #444',
    background: '#1f1f28',
    color: '#bbb',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
  },
  kindBtnCompact: { flex: '0 0 auto', padding: '7px 10px' },
  kindBtnActive: { background: '#3d6ea8', color: '#fff', borderColor: '#5a90c8' },
  kindCount: { marginLeft: 6, fontSize: 11, opacity: 0.7 },
  search: {
    flex: '1 1 240px',
    padding: '6px 8px',
    border: '1px solid #555',
    borderRadius: 4,
    background: '#1f1f28',
    color: '#e8e8e8',
    fontSize: 13,
  },
  fullWidthControl: { flex: '1 1 100%', width: '100%', maxWidth: 'none' },
  medalSelect: {
    padding: '6px 8px',
    border: '1px solid #555',
    borderRadius: 4,
    background: '#1f1f28',
    color: '#e8e8e8',
    fontSize: 12,
    maxWidth: 260,
  },
  moveTabs: { display: 'flex', gap: 4 },
  moveTabsCompact: { width: '100%', overflowX: 'auto', paddingBottom: 2 },
  moveBtn: {
    padding: '6px 10px',
    border: '1px solid #444',
    background: '#1f1f28',
    color: '#ddd',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    flex: '0 0 auto',
  },
  moveBtn_gu: { borderColor: '#7a3838' },
  moveBtn_choki: { borderColor: '#8a722e' },
  moveBtn_paa: { borderColor: '#2f5d92' },
  moveBtnActive: { background: '#3d6ea8', color: '#fff', borderColor: '#6fa4df' },
  stats: { fontSize: 12, color: '#888', marginLeft: 'auto' },
  statsCompact: { width: '100%', marginLeft: 0 },
  lastScan: {
    padding: '6px 10px',
    background: '#1c1c24',
    borderRadius: 4,
    color: '#cfc',
    fontSize: 12,
    border: '1px solid #2d4d2d',
  },
  lastScanNo: { color: '#9ad', marginRight: 4 },
  scanPending: { color: '#cc4', marginLeft: 4 },
  scanOk: { color: '#6c6', marginLeft: 4 },
  scanErr: { color: '#e66', marginLeft: 4 },
  body: { display: 'flex', gap: 12, minHeight: 0, flex: 1 },
  bodyCompact: { display: 'block', minHeight: 'auto' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 8,
    overflowY: 'auto',
    padding: 4,
    flex: 1,
    alignContent: 'start',
  },
  gridCompact: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
    overflowY: 'visible',
    gap: 6,
    padding: 0,
  },
  card: {
    background: '#1c1c24',
    border: '1px solid #2d2d3a',
    borderRadius: 4,
    padding: 6,
    cursor: 'pointer',
    color: '#e8e8e8',
    textAlign: 'left',
    font: 'inherit',
    transition: 'transform 0.08s, background 0.08s',
  },
  cardDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  cardImgBox: {
    height: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d0d12',
    borderRadius: 3,
  },
  cardImgBoxCompact: { height: 96 },
  cardImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  cardNoImg: { color: '#555', fontSize: 11 },
  cardNo: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#9ad',
    marginTop: 4,
  },
  cardName: { fontSize: 11, color: '#e8e8e8', marginTop: 2 },
  cardMove: { fontSize: 10, color: '#f0c85a', marginTop: 2 },
  cardSpecial: {
    fontSize: 10,
    color: '#b8d8ff',
    marginTop: 2,
    lineHeight: 1.25,
    wordBreak: 'break-word',
  },
};
