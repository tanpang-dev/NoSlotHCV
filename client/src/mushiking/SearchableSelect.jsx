import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * 文字入力でインクリメンタル絞り込みできるドロップダウン。
 * Props:
 *   options    : { value, label, sub? }[]  (sub は補足表示)
 *   value      : string | null
 *   onChange   : (value | null) => void
 *   placeholder: string
 *   getKeywords: (option) => string[]   (検索対象キーワード、省略時は label)
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '選択...',
  getKeywords,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef();

  useEffect(() => {
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const kw = getKeywords ? getKeywords(o) : [o.label];
      return kw.some((k) => String(k).toLowerCase().includes(q));
    });
  }, [options, query, getKeywords]);

  return (
    <div ref={ref} style={st.wrap}>
      <input
        type="text"
        value={open ? query : selected ? selected.label : ''}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => setQuery(e.target.value)}
        style={st.input}
      />
      {selected && !open && (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={st.clear}
          title="クリア"
        >
          ×
        </button>
      )}
      {open && (
        <div style={st.menu}>
          {filtered.length === 0 && <div style={st.empty}>該当なし</div>}
          {filtered.slice(0, 200).map((o) => (
            <div
              key={o.value}
              style={{
                ...st.item,
                ...(o.value === value ? st.itemActive : {}),
              }}
              onMouseDown={() => {
                onChange(o.value);
                setOpen(false);
                setQuery('');
              }}
            >
              <div style={st.itemLabel}>{o.label}</div>
              {o.sub && <div style={st.itemSub}>{o.sub}</div>}
            </div>
          ))}
          {filtered.length > 200 && (
            <div style={st.more}>...他 {filtered.length - 200} 件</div>
          )}
        </div>
      )}
    </div>
  );
}

const st = {
  wrap: { position: 'relative', width: '100%' },
  input: {
    width: '100%',
    padding: '6px 24px 6px 8px',
    border: '1px solid #555',
    borderRadius: 4,
    background: '#1f1f28',
    color: '#e8e8e8',
    fontSize: 13,
    boxSizing: 'border-box',
  },
  clear: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    color: '#aaa',
    border: 0,
    cursor: 'pointer',
    fontSize: 14,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    maxHeight: 280,
    overflowY: 'auto',
    background: '#262630',
    border: '1px solid #555',
    borderTop: 0,
    borderRadius: '0 0 4px 4px',
    zIndex: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  item: {
    padding: '6px 10px',
    cursor: 'pointer',
    borderBottom: '1px solid #2f2f3a',
    color: '#e8e8e8',
  },
  itemActive: { background: '#3d6ea8' },
  itemLabel: { fontSize: 13 },
  itemSub: { fontSize: 11, opacity: 0.6, marginTop: 2 },
  empty: { padding: 12, color: '#888', fontSize: 12 },
  more: { padding: 8, color: '#888', fontSize: 11, textAlign: 'center' },
};
