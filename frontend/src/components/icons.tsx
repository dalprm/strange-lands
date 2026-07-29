type GlyphProps = { size: number; tile?: boolean };

const tileFilter = { filter: 'drop-shadow(0 0 2px rgba(243,230,200,0.45))' };

export function CastleGlyph({ size, tile }: GlyphProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} aria-hidden style={{ display: 'block', flexShrink: 0, ...(tile ? tileFilter : {}) }}>
      <rect x="35" y="45" width="30" height="40" fill="#1a1208" />
      <rect x="10" y="35" width="22" height="50" fill="#1a1208" />
      <rect x="68" y="35" width="22" height="50" fill="#1a1208" />
      <polygon points="35,45 50,20 65,45" fill="#1a1208" />
      <polygon points="10,35 21,15 32,35" fill="#1a1208" />
      <polygon points="68,35 79,15 90,35" fill="#1a1208" />
      <path d="M43,85 L43,65 Q50,55 57,65 L57,85 Z" fill="#3a2a18" />
      <polygon points="50,8 62,12 50,16" fill="#c9a227" />
    </svg>
  );
}

export function WallGlyph({ size, tile }: GlyphProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} aria-hidden style={{ display: 'block', flexShrink: 0, ...(tile ? tileFilter : {}) }}>
      <rect x="5" y="50" width="90" height="45" fill="#1a1208" />
      {[5, 18, 31, 44, 57, 70, 83].map((x) => (
        <rect key={x} x={x} y="43" width="8" height="7" fill="#1a1208" />
      ))}
      <line x1="5" y1="60" x2="95" y2="60" stroke="#3a2a18" strokeWidth={1.5} />
      <line x1="5" y1="75" x2="95" y2="75" stroke="#3a2a18" strokeWidth={1.5} />
    </svg>
  );
}

export function BarrackGlyph({ size, tile }: GlyphProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} aria-hidden style={{ display: 'block', flexShrink: 0, ...(tile ? tileFilter : {}) }}>
      <rect x="10" y="35" width="80" height="55" fill="#1a1208" />
      <rect x="20" y="15" width="10" height="20" fill="#1a1208" />
      <rect x="70" y="18" width="8" height="17" fill="#1a1208" />
      <rect x="18" y="48" width="14" height="18" fill="#3a2a18" />
      <rect x="43" y="48" width="14" height="18" fill="#3a2a18" />
      <rect x="68" y="48" width="14" height="18" fill="#3a2a18" />
      <rect x="40" y="68" width="20" height="22" fill="#3a2a18" />
    </svg>
  );
}

export function BarrackGlyphTileWithCount({ count, size }: { count: number; size: number }) {
  return (
    <span className="fe-tile-text" style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }} aria-label={`Казарм: ${count}`}>
      <BarrackGlyph size={size} tile />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: -1,
          bottom: 1,
          minWidth: '0.85rem',
          padding: '0.06rem 0.2rem',
          fontSize: '0.55rem',
          fontWeight: 700,
          lineHeight: 1.1,
          textAlign: 'center',
          borderRadius: 5,
          background: 'rgba(26, 18, 8, 0.92)',
          border: '1px solid var(--fe-panel-edge)',
          color: 'var(--fe-ink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>
    </span>
  );
}

export function FogOfWarOverlay({ worldId, landId }: { worldId: number; landId: number }) {
  const uid = `fogW${worldId}L${landId}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      aria-hidden
      style={{ display: 'block' }}
    >
      <defs>
        <filter id={`${uid}-haze`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed={(worldId * 17 + landId) & 0xffff} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.85  0 0 0 0 0.82  0 0 0 0 0.72  0 0 0 0.45 0" result="mist" />
        </filter>
        <radialGradient id={`${uid}-veil`} cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="rgb(210, 200, 170)" stopOpacity={0.12} />
          <stop offset="55%" stopColor="rgb(160, 150, 120)" stopOpacity={0.28} />
          <stop offset="100%" stopColor="rgb(90, 80, 55)" stopOpacity={0.42} />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-veil)`} />
      <rect x="0" y="0" width="100" height="100" filter={`url(#${uid}-haze)`} opacity={0.55} style={{ mixBlendMode: 'soft-light' }} />
    </svg>
  );
}
