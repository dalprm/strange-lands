import type { DmMessage } from '../dm/messages';

type Props = {
  message: DmMessage | null;
};

export function DungeonMaster({ message }: Props) {
  const tone = message?.tone ?? 'info';
  const border =
    tone === 'danger'
      ? 'var(--fe-danger)'
      : tone === 'ok'
        ? 'var(--fe-ok)'
        : tone === 'warn'
          ? 'var(--fe-capture)'
          : 'var(--fe-panel-edge)';

  return (
    <div className="fe-frame" style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', borderColor: border }}>
      <img src="/ui/dm-bust.svg" alt="" width={48} height={60} style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div className="fe-title" style={{ fontSize: '0.72rem', color: 'var(--fe-accent)', marginBottom: '0.25rem' }}>
          Мастер подземелий
        </div>
        <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: 1.4 }}>
          {message?.text ?? 'Тишина в зале совета…'}
        </p>
      </div>
    </div>
  );
}
