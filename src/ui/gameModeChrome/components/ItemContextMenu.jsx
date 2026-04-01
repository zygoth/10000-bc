import { createPortal } from 'react-dom';

export default function ItemContextMenu({
  isDebriefActive,
  itemContextMenu,
  activeItemContextEntries,
  onRunQuickAction,
  onClose,
}) {
  if (isDebriefActive || !itemContextMenu) {
    return null;
  }
  return createPortal(
    <div
      className="iso-context-menu hud-item-context-menu"
      style={{ left: `${itemContextMenu.x}px`, top: `${itemContextMenu.y}px` }}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
    >
      {activeItemContextEntries.length === 0 ? (
        <p className="iso-context-menu-empty">No available actions</p>
      ) : (
        activeItemContextEntries.map((entry, entryIndex) => (
          <button
            key={`${itemContextMenu.source}-${entryIndex}-${entry.kind}-${entry.payload?.processId ?? ''}`}
            type="button"
            className={`iso-context-menu-action${entry.tickOverdraftWarning ? ' iso-context-menu-action--overdraft-warn' : ''}`}
            disabled={entry.disabled === true}
            title={
              entry.disabled === true && entry.disabledReason
                ? entry.disabledReason
                : entry.tickOverdraftWarning
                  ? 'Uses stored energy tomorrow (overdraft).'
                  : undefined
            }
            onClick={() => {
              if (entry.disabled === true) {
                return;
              }
              onRunQuickAction(entry.kind, entry.payload);
              onClose();
            }}
          >
            <span className="iso-context-menu-action-primary">{entry.label}</span>
            {entry.tickOverdraftWarning ? (
              <span className="iso-context-menu-action-warn">Uses tomorrow&apos;s energy</span>
            ) : null}
          </button>
        ))
      )}
    </div>,
    document.body,
  );
}

