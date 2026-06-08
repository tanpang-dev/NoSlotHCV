import { useCallback, useEffect, useState } from 'react';
import MushikingZukan from './MushikingZukan.jsx';
import MushikingBattle, { configureSummon } from './MushikingBattle.jsx';
import MushikingSettings from './MushikingSettings.jsx';
import MushikingImport from './MushikingImport.jsx';
import { configureBarcodes } from './barcode.js';

const DATA_URL = '/mushiking/db/cards.json';
const BARCODE_CONFIG_URL = '/mushiking/config/barcode.json';
const SUMMON_CONFIG_URL = '/mushiking/config/summon.json';

/* Optional config fetch — selection rules degrade gracefully if absent. */
async function fetchOptionalJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.innerWidth < 720);

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return compact;
}

export default function MushikingPanel({ standalone = false, onBack }) {
  const [db, setDb] = useState(null);
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState('zukan');
  const compact = useCompactLayout();

  const load = useCallback(async () => {
    setErr(null);
    setDb(null);
    try {
      // Load barcode/summon selection rules first so the cards render with
      // the right barcodes from the very first paint.
      const [barcodeCfg, summonCfg] = await Promise.all([
        fetchOptionalJson(BARCODE_CONFIG_URL),
        fetchOptionalJson(SUMMON_CONFIG_URL),
      ]);
      if (barcodeCfg) configureBarcodes(barcodeCfg);
      if (summonCfg) configureSummon(summonCfg);

      const r = await fetch(DATA_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDb(await r.json());
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onImported = useCallback(() => {
    setMode('zukan');
    load();
  }, [load]);

  return (
    <div style={{ ...st.root, ...(standalone ? st.rootStandalone : {}) }}>
      <div style={{ ...st.modeTabs, ...(standalone ? st.modeTabsStandalone : {}) }}>
        {standalone && (
          <button type="button" style={st.backBtn} onClick={onBack}>
            戻る
          </button>
        )}
        <div style={st.modeGroup}>
          <button
            style={{ ...st.modeBtn, ...(mode === 'zukan' ? st.modeBtnActive : {}) }}
            onClick={() => setMode('zukan')}
          >
            図鑑
          </button>
          <button
            style={{ ...st.modeBtn, ...(mode === 'battle' ? st.modeBtnActive : {}) }}
            onClick={() => setMode('battle')}
          >
            対戦
          </button>
          <button
            style={{ ...st.modeBtn, ...(mode === 'data' ? st.modeBtnActive : {}) }}
            onClick={() => setMode('data')}
          >
            データ
          </button>
          <button
            style={{ ...st.modeBtn, ...(mode === 'settings' ? st.modeBtnActive : {}) }}
            onClick={() => setMode('settings')}
          >
            設定
          </button>
        </div>
        {db && (
          <span style={{ ...st.summary, ...(compact ? st.summaryCompact : {}) }}>
            ムシ {db.mushi_cards.length} / わざ {(db.waza_cards || []).length} / アダー{' '}
            {(db.ada_cards || []).length} / ライセンス {(db.license_cards || []).length}
          </span>
        )}
      </div>
      <div style={st.body}>
        {(mode === 'zukan' || mode === 'battle') && err && (
          <div style={st.error}>
            cards.json の読み込みに失敗しました: {err}
            <br />
            <small>「データ」タブから cards.json を読み込んでください。</small>
          </div>
        )}
        {(mode === 'zukan' || mode === 'battle') && !err && !db && (
          <div style={st.loading}>読込中...</div>
        )}
        {mode === 'zukan' && db && <MushikingZukan db={db} compact={compact} />}
        {mode === 'battle' && db && <MushikingBattle db={db} compact={compact} />}
        {mode === 'data' && <MushikingImport onReload={onImported} />}
        {mode === 'settings' && <MushikingSettings />}
      </div>
    </div>
  );
}

const st = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    color: '#e8e8e8',
    background: '#15151c',
    borderRadius: 6,
    padding: 12,
  },
  rootStandalone: {
    height: '100vh',
    minHeight: '100vh',
    borderRadius: 0,
    padding: 10,
    boxSizing: 'border-box',
  },
  modeTabs: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingBottom: 8,
    borderBottom: '1px solid #2d2d3a',
    marginBottom: 8,
  },
  modeTabsStandalone: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: '#15151c',
  },
  modeGroup: { display: 'flex', gap: 6 },
  backBtn: {
    padding: '8px 12px',
    border: '1px solid #444',
    background: '#23232d',
    color: '#e8e8e8',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modeBtn: {
    padding: '8px 14px',
    border: '1px solid #444',
    background: '#1f1f28',
    color: '#bbb',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modeBtnActive: { background: '#3d6ea8', color: '#fff', borderColor: '#5a90c8' },
  summary: { marginLeft: 'auto', fontSize: 12, color: '#888' },
  summaryCompact: { width: '100%', marginLeft: 0, fontSize: 11 },
  body: { flex: 1, minHeight: 0, overflowY: 'auto' },
  error: {
    padding: 16,
    background: '#3a1a1a',
    color: '#ffb',
    borderRadius: 4,
    fontSize: 13,
  },
  loading: { padding: 16, color: '#888' },
};
