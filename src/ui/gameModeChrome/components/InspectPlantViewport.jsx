import { useEffect, useRef, useState } from 'react';

/** Blob URLs keyed by full SVG URL — revisiting inspect is instant after first load. */
const inspectSvgHrefCache = new Map();

function resolveSvgFetchUrl(imagePath) {
  const base = process.env.PUBLIC_URL || '';
  return `${base}${imagePath}`;
}

/**
 * Large plant preview: SVG when available (fetched + cached), else PNG atlas slice.
 */
let inspectClipPathSeq = 0;

export default function InspectPlantViewport({ svg = null, spriteStyle = null, resetKey }) {
  const clipPathIdRef = useRef(null);
  if (clipPathIdRef.current == null) {
    inspectClipPathSeq += 1;
    clipPathIdRef.current = `inspect-cell-${inspectClipPathSeq}`;
  }
  const clipPathId = clipPathIdRef.current;
  const [svgDisplayHref, setSvgDisplayHref] = useState(null);

  useEffect(() => {
    if (!svg?.imagePath) {
      setSvgDisplayHref(null);
      return undefined;
    }
    const url = resolveSvgFetchUrl(svg.imagePath);
    const cached = inspectSvgHrefCache.get(url);
    if (cached) {
      setSvgDisplayHref(cached);
      return undefined;
    }

    const ac = new AbortController();
    setSvgDisplayHref(null);

    (async () => {
      try {
        const res = await fetch(url, { signal: ac.signal, cache: 'default' });
        if (!res.ok) {
          throw new Error(`SVG fetch ${res.status}`);
        }
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        inspectSvgHrefCache.set(url, objectUrl);
        if (!ac.signal.aborted) {
          setSvgDisplayHref(objectUrl);
        }
      } catch (err) {
        if (err?.name === 'AbortError') {
          return;
        }
        if (!ac.signal.aborted) {
          setSvgDisplayHref(url);
        }
      }
    })();

    return () => ac.abort();
  }, [svg?.imagePath, resetKey]);

  if (!svg && !spriteStyle) {
    return null;
  }

  const svgLoading = Boolean(svg && !svgDisplayHref);

  return (
    <div className="hud-inspect-viewport-wrap">
      <div
        className="hud-inspect-viewport"
        role="img"
        aria-label={svgLoading ? 'Loading plant illustration' : 'Plant illustration'}
        aria-busy={svgLoading || undefined}
      >
        <div className="hud-inspect-viewport-inner">
          {svgLoading ? (
            <div className="hud-inspect-viewport-loading">
              <div className="hud-inspect-viewport-spinner" aria-hidden="true" />
              <span className="hud-inspect-viewport-loading-label">Loading…</span>
            </div>
          ) : null}
          {svg && svgDisplayHref ? (
            <svg
              className="hud-inspect-viewport-svg"
              viewBox={`${svg.viewBoxFrame.x} ${svg.viewBoxFrame.y} ${svg.viewBoxFrame.w} ${svg.viewBoxFrame.h}`}
              preserveAspectRatio="xMidYMid meet"
              overflow="hidden"
              aria-hidden="true"
            >
              <defs>
                <clipPath id={clipPathId} clipPathUnits="userSpaceOnUse">
                  <rect
                    x={svg.viewBoxFrame.x}
                    y={svg.viewBoxFrame.y}
                    width={svg.viewBoxFrame.w}
                    height={svg.viewBoxFrame.h}
                  />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clipPathId})`}>
                <image
                  href={svgDisplayHref}
                  x={0}
                  y={0}
                  width={svg.viewBoxFull.w}
                  height={svg.viewBoxFull.h}
                />
              </g>
            </svg>
          ) : null}
          {!svg && spriteStyle ? (
            <span className="hud-inspect-sprite" style={spriteStyle} aria-hidden="true" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
