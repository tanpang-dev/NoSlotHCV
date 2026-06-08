import { useState } from 'react';

/* Wi-Fi "key baker" UI.
 * SSID + passphrase -> server computes the PMK and patches MWIFI.BIN ->
 * the browser downloads the ready-to-copy file. The passphrase only travels
 * to the local server and is never stored. */
export default function MushikingSettings() {
  const [ssid, setSsid] = useState('');
  const [psk, setPsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  const canBake = ssid.trim().length >= 1 && psk.length >= 8 && !busy;

  const onBake = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/mushiking/bake-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid: ssid.trim(), psk }),
      });
      const type = res.headers.get('Content-Type') || '';
      if (!res.ok || type.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: data.error || `エラー (HTTP ${res.status})` });
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'MWIFI.BIN';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      setMsg({ ok: true, text: 'MWIFI.BIN をダウンロードしました。SDカードのルートに置いてください。' });
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'ネットワークエラー' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={st.root}>
      <h2 style={st.h2}>WiFi 設定（鍵焼き）</h2>
      <p style={st.lead}>
        お使いの WiFi の SSID とパスワードを入力すると、3DS に入れる
        <code style={st.code}> MWIFI.BIN </code>
        にあなた専用の鍵を書き込んでダウンロードします。パスワードはこの PC 内だけで使われ、保存されません。
      </p>

      <label style={st.label}>
        SSID（WiFi名）
        <input
          type="text"
          value={ssid}
          onChange={(e) => setSsid(e.target.value)}
          placeholder="例: MyHomeWifi"
          style={st.input}
          autoComplete="off"
        />
      </label>
      <label style={st.label}>
        パスワード（8文字以上）
        <input
          type="password"
          value={psk}
          onChange={(e) => setPsk(e.target.value)}
          placeholder="WiFi のパスワード"
          style={st.input}
          autoComplete="off"
        />
      </label>

      <button type="button" onClick={onBake} disabled={!canBake} style={{ ...st.btn, ...(canBake ? {} : st.btnDisabled) }}>
        {busy ? '生成中…' : 'MWIFI.BIN を作ってダウンロード'}
      </button>

      {msg && (
        <div style={{ ...st.msg, ...(msg.ok ? st.msgOk : st.msgErr) }}>
          {msg.ok ? '✓ ' : '✗ '}{msg.text}
        </div>
      )}

      <div style={st.notice}>
        <b>つながる WiFi の条件</b>
        <ul style={st.ul}>
          <li>WPA2-PSK（AES）であること</li>
          <li>PMF / 802.11w が<b>無効</b>（WPA3 や iPhoneテザリング iOS15+ は不可）</li>
          <li>2.4GHz、3DS と PC が<b>同じネットワーク</b></li>
        </ul>
      </div>
    </div>
  );
}

const st = {
  root: { maxWidth: 480, margin: '0 auto', padding: 8, color: '#e8e8e8' },
  h2: { fontSize: 16, margin: '4px 0 8px' },
  lead: { fontSize: 12, color: '#bbb', lineHeight: 1.6 },
  code: { background: '#000', padding: '1px 4px', borderRadius: 3, color: '#9ad' },
  label: { display: 'block', fontSize: 12, color: '#cfcfcf', marginTop: 12 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 4,
    padding: '8px 10px',
    border: '1px solid #555',
    borderRadius: 4,
    background: '#1f1f28',
    color: '#e8e8e8',
    fontSize: 14,
  },
  btn: {
    marginTop: 16,
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #5a90c8',
    background: '#3d6ea8',
    color: '#fff',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  msg: { marginTop: 12, padding: '8px 10px', borderRadius: 4, fontSize: 12 },
  msgOk: { background: '#1c2a1c', color: '#9f9', border: '1px solid #2d4d2d' },
  msgErr: { background: '#2a1c1c', color: '#f99', border: '1px solid #4d2d2d' },
  notice: {
    marginTop: 20,
    padding: '10px 12px',
    background: '#1c1c24',
    border: '1px solid #2d2d3a',
    borderRadius: 4,
    fontSize: 12,
    color: '#cfcfcf',
  },
  ul: { margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.7 },
};
