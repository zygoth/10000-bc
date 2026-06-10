import { useLayoutEffect, useRef, useState } from 'react';
import { gridSlotSpriteFillStyleForWidth } from '../../game/inventoryPanelEntries.mjs';

/**
 * Fills a square inventory cell: measures host width and paints atlas with pixel `background-*`
 * (avoids `cqw`/`calc` bugs that pin the atlas at 0,0).
 *
 * `fixedSlotWidthPx` is only an **initial** width and a **fallback** if layout has not given the
 * host a size yet. We always `ResizeObserver` the host when possible so the atlas scale matches
 * the **actual** cell (e.g. HUD grid columns are often ~48–50px, not 56) — using a hard 56 for
 * math in a 48px box clips the sprite on one side.
 */
export default function InventorySlotSpriteFill({ sprite, fixedSlotWidthPx = null, fallbackLabel = '' }) {
  const hostRef = useRef(null);
  const [slotW, setSlotW] = useState(() => (
    fixedSlotWidthPx != null ? Math.max(1, Math.round(Number(fixedSlotWidthPx))) : 0
  ));

  useLayoutEffect(() => {
    const fb = fixedSlotWidthPx != null ? Math.max(1, Math.round(Number(fixedSlotWidthPx))) : 64;
    const measure = () => {
      const el = hostRef.current;
      if (!el) {
        return;
      }
      let w = Math.round(el.getBoundingClientRect().width);
      if (w < 1) {
        w = el.offsetWidth;
      }
      if (w < 1) {
        w = fb;
      }
      setSlotW(Math.max(1, w));
    };
    const attach = (node) => {
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(node);
      return ro;
    };
    let el = hostRef.current;
    if (!el) {
      let raf = 0;
      let left = 6;
      let ro = null;
      const retry = () => {
        const node = hostRef.current;
        if (node) {
          ro = attach(node);
          return;
        }
        left -= 1;
        if (left > 0) {
          raf = requestAnimationFrame(retry);
        } else {
          setSlotW(fb);
        }
      };
      raf = requestAnimationFrame(retry);
      return () => {
        cancelAnimationFrame(raf);
        if (ro) {
          ro.disconnect();
        }
      };
    }
    const ro = attach(el);
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

