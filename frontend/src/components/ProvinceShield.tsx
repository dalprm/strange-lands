import type { LandDto } from '../api/client';
import {
  empireHeraldry,
  type EmpireSlot,
} from '../land/heraldry';
import {
  landBarrackCount,
  landHasCastle,
  landHasWall,
} from '../land/helpers';

/** Контур щита heater (оригинал под FE-роль маркера провинции). */
export const SHIELD_PATH =
  'M50 4 L88 18 L88 52 C88 78 68 92 50 96 C32 92 12 78 12 52 L12 18 Z';

/** Цвет обводки: цель/источник > выбрано (для своей — цвет из heraldry). */
export function resolveShieldFocusColor(flags: {
  isCaptureSource?: boolean;
  isCaptureTarget?: boolean;
  isSelected?: boolean;
  /** Своя выбранная земля: светлее градиента щита; иначе нейтраль/чужая */
  selectedOwnRing?: string | null;
}): string | null {
  if (flags.isCaptureSource) return 'var(--fe-capture)';
  if (flags.isCaptureTarget) return 'var(--fe-target)';
  if (flags.isSelected) {
    return flags.selectedOwnRing ?? 'var(--fe-selected)';
  }
  return null;
}

function ShieldFocusStroke({ color }: { color: string }) {
  return (
    <path
      d={SHIELD_PATH}
      fill="none"
      stroke={color}
      strokeWidth={8}
      strokeLinejoin="round"
      strokeLinecap="round"
      opacity={0.95}
    />
  );
}

/** Пустой контур щита (нейтраль / цель без герба). */
export function EmptyShieldOutline({
  size = 36,
  focusColor,
  className,
}: {
  size?: number;
  focusColor: string;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden
      style={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.55))' }}
    >
      <ShieldFocusStroke color={focusColor} />
      <path
        d={SHIELD_PATH}
        fill="rgba(26, 18, 8, 0.45)"
        stroke="rgba(201, 162, 39, 0.55)"
        strokeWidth={2.5}
      />
    </svg>
  );
}

type BannerProps = {
  slot: EmpireSlot;
  size?: number;
  className?: string;
  title?: string;
  /** Обводка состояния (выбор / ход / перемещение) */
  focusColor?: string | null;
};

/** Щит империи — цвет + уникальный герб слота 0…5. */
export function BannerShield({ slot, size = 36, className, title, focusColor }: BannerProps) {
  const h = empireHeraldry(slot);
  const uid = `ban-${slot}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden={title == null}
      role={title != null ? 'img' : undefined}
      aria-label={title}
      style={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))' }}
    >
      <defs>
        <linearGradient id={`${uid}-g`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={h.highlight} />
          <stop offset="55%" stopColor={h.fill} />
          <stop offset="100%" stopColor="#1a1208" stopOpacity={0.85} />
        </linearGradient>
      </defs>
      {focusColor != null && focusColor !== '' && <ShieldFocusStroke color={focusColor} />}
      <path d={SHIELD_PATH} fill={`url(#${uid}-g)`} stroke={h.stroke} strokeWidth={3.5} />
      <path
        d="M50 10 L80 22 L80 50 C80 70 64 82 50 86 C36 82 20 70 20 50 L20 22 Z"
        fill="none"
        stroke={h.crest}
        strokeOpacity={0.22}
        strokeWidth={1.5}
      />
      <g fill={h.crest} stroke="none">
        <CrestMark slot={slot} />
      </g>
    </svg>
  );
}

function CrestMark({ slot }: { slot: EmpireSlot }) {
  switch (slot) {
    case 0:
      /* крест */
      return (
        <>
          <rect x="44" y="22" width="12" height="52" rx="1.5" />
          <rect x="28" y="36" width="44" height="12" rx="1.5" />
        </>
      );
    case 1:
      /* шеврон */
      return <polygon points="50,28 78,58 70,58 50,40 30,58 22,58" />;
    case 2:
      /* столб */
      return <rect x="42" y="22" width="16" height="52" rx="2" />;
    case 3:
      /* круг / солнце */
      return (
        <>
          <circle cx="50" cy="46" r="16" />
          <circle cx="50" cy="46" r="7" fill="#1a1208" opacity={0.35} />
        </>
      );
    case 4:
      /* перевязь */
      return <polygon points="28,24 40,24 78,68 66,68" />;
    case 5:
      /* два ромба */
      return (
        <>
          <polygon points="36,34 50,22 64,34 50,46" />
          <polygon points="36,62 50,50 64,62 50,74" />
        </>
      );
    default:
      return null;
  }
}

type SlotIcon = 'castle' | 'barrack' | 'wall' | 'troops' | 'hero' | 'magic' | 'cleric';

/** Шаг сетки: одинаковый по X и Y (центры иконок). Фиксированная 2-2-2-1. */
const CONTENT_PITCH = 18;
const CONTENT_ICON = 14;
const CONTENT_COL_L = 50 - CONTENT_PITCH / 2;
const CONTENT_COL_R = 50 + CONTENT_PITCH / 2;
const CONTENT_COL_C = 50;
/** Верх первого ряда — сетка всегда на полную высоту, без сжатия. */
const CONTENT_ROW0_Y = 26;

/**
 * Фиксированные слоты 2-2-2-1 (как в FE Contents):
 * замок·казармы / воины·герои / клерик·маг / крепость
 */
const CONTENT_SLOTS: { kind: SlotIcon; x: number; y: number }[] = [
  { kind: 'castle', x: CONTENT_COL_L, y: CONTENT_ROW0_Y },
  { kind: 'barrack', x: CONTENT_COL_R, y: CONTENT_ROW0_Y },
  { kind: 'troops', x: CONTENT_COL_L, y: CONTENT_ROW0_Y + CONTENT_PITCH },
  { kind: 'hero', x: CONTENT_COL_R, y: CONTENT_ROW0_Y + CONTENT_PITCH },
  { kind: 'cleric', x: CONTENT_COL_L, y: CONTENT_ROW0_Y + CONTENT_PITCH * 2 },
  { kind: 'magic', x: CONTENT_COL_R, y: CONTENT_ROW0_Y + CONTENT_PITCH * 2 },
  { kind: 'wall', x: CONTENT_COL_C, y: CONTENT_ROW0_Y + CONTENT_PITCH * 3 },
];

/** Как WarriorType.isHero(): HERO_* + CLERIC + MAGIC. */
function isHeroUnitType(type: string): boolean {
  return type.startsWith('HERO_') || type === 'CLERIC' || type === 'MAGIC';
}

type ContentsProps = {
  land: LandDto;
  size?: number;
  className?: string;
  focusColor?: string | null;
};

/** Щит «здания и войска» — фиксированная сетка 2-2-2-1. */
export function ContentsShield({ land, size = 40, className, focusColor }: ContentsProps) {
  const present = contentPresence(land);
  const any = CONTENT_SLOTS.some((s) => present[s.kind]);
  const uid = `cnt-${land.id}`;
  const half = CONTENT_ICON / 2;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden
      style={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))' }}
    >
      <defs>
        <linearGradient id={`${uid}-g`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4a3a28" />
          <stop offset="100%" stopColor="#1a1208" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={SHIELD_PATH} />
        </clipPath>
      </defs>
      {focusColor != null && focusColor !== '' && <ShieldFocusStroke color={focusColor} />}
      <path d={SHIELD_PATH} fill={`url(#${uid}-g)`} stroke="#c9a227" strokeWidth={3.2} />
      <g clipPath={`url(#${uid}-clip)`}>
        {!any ? (
          <text
            x="50"
            y="52"
            textAnchor="middle"
            fill="#c4b48a"
            fontSize="11"
            fontFamily="serif"
            opacity={0.7}
          >
            —
          </text>
        ) : (
          CONTENT_SLOTS.map((slot) =>
            present[slot.kind] ? (
              <g
                key={slot.kind}
                transform={`translate(${slot.x - half}, ${slot.y - half}) scale(${CONTENT_ICON / 16})`}
              >
                <MiniIcon kind={slot.kind} />
              </g>
            ) : null,
          )
        )}
      </g>
    </svg>
  );
}

function contentPresence(land: LandDto): Record<SlotIcon, boolean> {
  const b = land.buildings;
  const warriors = land.warriors?.filter((w) => (w.count ?? 0) > 0 && w.type) ?? [];
  const hasHero = warriors.some((w) => isHeroUnitType(w.type ?? ''));
  const hasTroops = warriors.some((w) => !isHeroUnitType(w.type ?? ''));
  return {
    castle: landHasCastle(b),
    barrack: landBarrackCount(b) > 0,
    troops: hasTroops,
    hero: hasHero,
    cleric: (b?.clericCastleCount ?? 0) > 0,
    magic: (b?.magicCastleCount ?? 0) > 0,
    wall: landHasWall(b),
  };
}

function MiniIcon({ kind }: { kind: SlotIcon }) {
  const ink = '#f3e6c8';
  const dark = '#1a1208';
  switch (kind) {
    case 'castle':
      return (
        <g>
          <rect x="5" y="7" width="6" height="9" fill={dark} stroke={ink} strokeWidth={0.8} />
          <rect x="0" y="5" width="4" height="11" fill={dark} stroke={ink} strokeWidth={0.8} />
          <rect x="12" y="5" width="4" height="11" fill={dark} stroke={ink} strokeWidth={0.8} />
          <polygon points="5,7 8,2 11,7" fill={ink} />
        </g>
      );
    case 'barrack':
      return (
        <g>
          <rect x="1" y="5" width="14" height="10" fill={dark} stroke={ink} strokeWidth={0.8} />
          <rect x="3" y="7" width="3" height="3" fill={ink} opacity={0.7} />
          <rect x="7" y="7" width="3" height="3" fill={ink} opacity={0.7} />
          <rect x="11" y="7" width="2" height="3" fill={ink} opacity={0.7} />
        </g>
      );
    case 'wall':
      return (
        <g>
          <rect x="0" y="8" width="16" height="7" fill={dark} stroke={ink} strokeWidth={0.8} />
          {[0, 4, 8, 12].map((x) => (
            <rect key={x} x={x} y="5" width="3" height="3" fill={dark} stroke={ink} strokeWidth={0.6} />
          ))}
        </g>
      );
    case 'troops':
      return (
        <g stroke={ink} fill="none" strokeWidth={1.2} strokeLinecap="round">
          <line x1="8" y1="1" x2="8" y2="14" />
          <line x1="3" y1="5" x2="13" y2="5" />
          <circle cx="8" cy="3" r="1.5" fill={ink} />
        </g>
      );
    case 'hero':
      return (
        <g>
          <circle cx="8" cy="5" r="3" fill={ink} />
          <path d="M3 15 Q8 9 13 15" fill={ink} />
        </g>
      );
    case 'magic':
      return (
        <g fill={ink}>
          <polygon points="8,1 9.5,6 15,6 10.5,9 12,14 8,11 4,14 5.5,9 1,6 6.5,6" />
        </g>
      );
    case 'cleric':
      return (
        <g fill={ink}>
          <rect x="7" y="1" width="2" height="14" />
          <rect x="3" y="5" width="10" height="2" />
        </g>
      );
    default:
      return null;
  }
}

/** Компактный щит для легенды / TurnBar. */
export function LegendBannerShield({
  slot,
  size = 16,
}: {
  slot: EmpireSlot;
  size?: number;
}) {
  return <BannerShield slot={slot} size={size} />;
}
