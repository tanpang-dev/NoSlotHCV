import { useEffect, useRef, useState } from 'react';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

/* Card-data import wizard for non-technical users.
 * Lets the user drop in their own cards.json / images / config without editing
 * files by hand; everything is POSTed to the local server which saves it under
 * data/ and config/. */
export default function MushikingImport({ onReload }) {
  const [status, setStatus] = useState(null); // { cardsSource, imageCount }
  const [cardsMsg, setCardsMsg] = useState(null);
  const [cfgMsg, setCfgMsg] = useState(null);
  const [imgProgress, setImgProgress] = useState(null); // { done, total, error? }
  const folderRef = useRef(null);

  const refreshStatus = async () => {
    try {
      const r = await fetch('/mushiking/import/status');
      if (r.ok) setStatus(await r.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    refreshStatus();
    // webkitdirectory is non-standard, so set it imperatively.
    if (folderRef.current) {
      folderRef.current.setAttribute('webkitdirectory', '');
      folderRef.current.setAttribute('directory', '');
    }
  }, []);

  const onCardsFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCardsMsg({ busy: true });
    try {
      const text = await file.text();
      const r = await fetch('/mushiking/import/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        setCardsMsg({ ok: false, text: data.error || `エラー (HTTP ${r.status})` });
      } else {
        const c = data.counts || {};
        setCardsMsg({ ok: true, text: `読み込み成功: ムシ ${c.mushi} / わざ ${c.waza} / アダー ${c.ada} / ライセンス ${c.license}` });
        refreshStatus();
      }
    } catch (err) {
      setCardsMsg({ ok: false, text: err.message });
    }
  };

  const onConfigFile = async (e, endpoint, label) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCfgMsg({ busy: true });
    try {
      const text = await file.text();
      const r = await fetch(`/mushiking/import/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      const data = await r.json().catch(() => ({}));
      setCfgMsg(r.ok && data.ok
        ? { ok: true, text: `${label} を保存しました` }
        : { ok: false, text: data.error || `エラー (HTTP ${r.status})` });
    } catch (err) {
      setCfgMsg({ ok: false, text: err.message });
    }
  };

  const onFolder = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => IMAGE_EXT.test(f.name));
    e.target.value = '';
    if (!files.length) {
      setImgProgress({ done: 0, total: 0, error: '画像ファイルが見つかりませんでした' });
      return;
    }
    setImgProgress({ done: 0, total: files.length });
    let done = 0;
    for (const f of files) {
      // strip the top-level selected folder so paths map to data/images/<...>
      const rel = (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name;
      try {
        await fetch(`/mushiking/import/image?path=${encodeURIComponent(rel)}`, {
          method: 'PUT',
          body: f,
        });
      } catch { /* keep going; summary below */ }
      done++;
      if (done % 5 === 0 || done === files.length) setImgProgress({ done, total: files.length });
    }
    setImgProgress({ done: files.length, total: files.length });
    refreshStatus();
  };

  return (
    <div style={st.root}>
      <h2 style={st.h2}>カードデータの読み込み</h2>
      <p style={st.lead}>
        このアプリは著作物を含みません。お手元の <code style={st.code}>cards.json</code> と画像を読み込んで使います。
        形式は <code style={st.code}>data/cards.schema.json</code> を参照してください。
      </p>

      {status && (
        <div style={st.status}>
          現在のデータ: <b>{status.cardsSource === 'user' ? '読み込み済み（あなたのデータ）' : 'サンプル（ダミー）'}</b>
          {' / '}画像 <b>{status.imageCount}</b> 枚
        </div>
      )}

      <div style={st.step}>
        <div style={st.stepTitle}>① カードデータ（cards.json）</div>
        <input type="file" accept="application/json,.json" onChange={onCardsFile} style={st.file} />
        {cardsMsg?.busy && <div style={st.note}>読み込み中…</div>}
        {cardsMsg && !cardsMsg.busy && (
          <div style={{ ...st.msg, ...(cardsMsg.ok ? st.ok : st.err) }}>{cardsMsg.ok ? '✓ ' : '✗ '}{cardsMsg.text}</div>
        )}
      </div>

      <div style={st.step}>
        <div style={st.stepTitle}>② 画像フォルダ（任意）</div>
        <div style={st.hint}>画像を入れたフォルダを選ぶと、中身を data/images に取り込みます。</div>
        <input ref={folderRef} type="file" multiple onChange={onFolder} style={st.file} />
        {imgProgress && (
          imgProgress.error
            ? <div style={{ ...st.msg, ...st.err }}>✗ {imgProgress.error}</div>
            : <div style={st.note}>取り込み: {imgProgress.done} / {imgProgress.total}{imgProgress.done === imgProgress.total ? ' ✓' : '…'}</div>
        )}
      </div>

      <div style={st.step}>
        <div style={st.stepTitle}>③ 選択ルール（任意・上級者向け）</div>
        <div style={st.hint}>バーコードの選び方や召喚カードの設定を差し替える場合のみ。</div>
        <label style={st.cfgRow}>
          <span>barcode-config.json</span>
          <input type="file" accept=".json,application/json" onChange={(e) => onConfigFile(e, 'barcode-config', 'バーコード設定')} style={st.fileSm} />
        </label>
        <label style={st.cfgRow}>
          <span>summon-cards.json</span>
          <input type="file" accept=".json,application/json" onChange={(e) => onConfigFile(e, 'summon', '召喚カード設定')} style={st.fileSm} />
        </label>
        {cfgMsg && !cfgMsg.busy && (
          <div style={{ ...st.msg, ...(cfgMsg.ok ? st.ok : st.err) }}>{cfgMsg.ok ? '✓ ' : '✗ '}{cfgMsg.text}</div>
        )}
      </div>

      <button type="button" style={st.reload} onClick={() => onReload?.()}>
        反映する（再読み込み）
      </button>
    </div>
  );
}

const st = {
  root: { maxWidth: 520, margin: '0 auto', padding: 8, color: '#e8e8e8' },
  h2: { fontSize: 16, margin: '4px 0 8px' },
  lead: { fontSize: 12, color: '#bbb', lineHeight: 1.6 },
  code: { background: '#000', padding: '1px 4px', borderRadius: 3, color: '#9ad' },
  status: { margin: '8px 0', padding: '8px 10px', background: '#1c1c24', border: '1px solid #2d2d3a', borderRadius: 4, fontSize: 12 },
  step: { marginTop: 14, padding: '10px 12px', background: '#17171e', border: '1px solid #2d2d3a', borderRadius: 4 },
  stepTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 6 },
  hint: { fontSize: 11, color: '#999', marginBottom: 6 },
  file: { fontSize: 12, color: '#ddd' },
  fileSm: { fontSize: 11, color: '#ddd' },
  cfgRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 6 },
  note: { fontSize: 12, color: '#cc4', marginTop: 6 },
  msg: { marginTop: 6, padding: '6px 8px', borderRadius: 4, fontSize: 12 },
  ok: { background: '#1c2a1c', color: '#9f9', border: '1px solid #2d4d2d' },
  err: { background: '#2a1c1c', color: '#f99', border: '1px solid #4d2d2d' },
  reload: {
    marginTop: 18, width: '100%', padding: '10px 14px',
    border: '1px solid #5a90c8', background: '#3d6ea8', color: '#fff',
    borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 'bold',
  },
};
