import MushikingPanel from './mushiking/MushikingPanel.jsx';

// Standalone NoSlotHCV UI: the card feed is the whole app (no GBA-to-PC shell).
export default function App() {
  return (
    <div style={{ height: '100vh', background: '#0f0f14' }}>
      <MushikingPanel />
    </div>
  );
}
