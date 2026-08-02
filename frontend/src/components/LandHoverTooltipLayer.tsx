import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';

export type LandHoverTooltipApi = {
  show: (title: string, lines: string[], clientX: number, clientY: number) => void;
  move: (clientX: number, clientY: number) => void;
  hide: () => void;
};

type TipContent = {
  title: string;
  lines: string[];
};

function clampTipPos(clientX: number, clientY: number): { x: number; y: number } {
  const pad = 12;
  return {
    x: Math.min(clientX + pad, window.innerWidth - 260),
    y: Math.min(clientY + pad, window.innerHeight - 140),
  };
}

/**
 * Тултип земли: state локальный, чтобы ProvinceMap не перерисовывался на mousemove.
 * Позиция на move обновляется через DOM (без setState).
 */
export function LandHoverTooltipLayer({
  apiRef,
  hidden,
}: {
  apiRef: MutableRefObject<LandHoverTooltipApi | null>;
  /** Контекстное меню / pan — скрыть оверлей */
  hidden: boolean;
}) {
  const [content, setContent] = useState<TipContent | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: 0, y: 0 });

  const applyPos = (clientX: number, clientY: number) => {
    const next = clampTipPos(clientX, clientY);
    posRef.current = next;
    const el = rootRef.current;
    if (el != null) {
      el.style.left = `${next.x}px`;
      el.style.top = `${next.y}px`;
    }
  };

  useLayoutEffect(() => {
    apiRef.current = {
      show(title, lines, clientX, clientY) {
        applyPos(clientX, clientY);
        setContent({ title, lines });
      },
      move(clientX, clientY) {
        applyPos(clientX, clientY);
      },
      hide() {
        setContent(null);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  useEffect(() => {
    if (hidden) {
      setContent(null);
    }
  }, [hidden]);

  useLayoutEffect(() => {
    if (content == null) return;
    const el = rootRef.current;
    if (el == null) return;
    el.style.left = `${posRef.current.x}px`;
    el.style.top = `${posRef.current.y}px`;
  }, [content]);

  if (hidden || content == null) {
    return null;
  }

  return (
    <div ref={rootRef} className="fe-tooltip" role="tooltip" style={{ left: posRef.current.x, top: posRef.current.y }}>
      <div className="fe-tooltip-title">{content.title}</div>
      {content.lines.map((line) => (
        <div key={line} className="fe-tooltip-line">
          {line}
        </div>
      ))}
    </div>
  );
}
