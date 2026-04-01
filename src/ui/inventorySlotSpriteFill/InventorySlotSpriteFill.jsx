import { useLayoutEffect, useRef, useState } from 'react';
import { gridSlotSpriteFillStyleForWidth } from '../../game/inventoryPanelEntries.mjs';

/**
 * Fills a square inventory cell: measures host width and paints atlas with pixel `background-*`
 * (avoids `cqw`/`calc` bugs that pin the atlas at 0,0).
 */
export default function InventorySlotSpriteFill({ sprite, fixedSlotWidthPx = null, fallbackLabel = '' }) {
  const hostRef = useRef(null);
  const [slotW, setSlotW] = useState(() => (
    fixedSlotWidthPx != null ? Math.max(1, Math.round(Number(fixedSlotWidthPx))) : 0
  ));

  useLayoutEffect(() => {
    if (fixedSlotWidthPx != null) {
      setSlotW(Math.max(1, Math.round(Number(fixedSlotWidthPx))));
      return undefined;
    }
    const el = hostRef.current;
    if (!el) {
      return undefined;
    }
    const measure = () => {
      let w = Math.round(el.getBoundingClientRect().width);
      if (w < 1) {
        w = el.offsetWidth;
      }
      /* jsdom often reports 0 before layout; real slots get a follow-up ResizeObserver tick. */
      if (w < 1) {
        w = 64;
      }
      setSlotW(Math.max(1, w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixedSlotWidthPx]);

  const style = sprite && slotW > 0 ? gridSlotSpriteFillStyleForWidth(sprite, slotW) : null;
  const empty = !sprite || !style;
  const labelText = typeof fallbackLabel === 'string' ? fallbackLabel.trim() : '';
  const showNameFallback = empty && labelText.length > 0;

  return (
    <span ref={hostRef} className="slot-sprite-fill-host" aria-hidden="true">
      <span
        className={`slot-sprite-fill ${empty ? 'slot-sprite-fill--empty' : ''}`}
        style={style || undefined}
      />
      {showNameFallback ? (
        <span className="slot-sprite-fill-fallback" title={labelText}>
          {labelText}
        </span>
      ) : null}
    </span>
  );
}

