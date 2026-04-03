import { getTechResearchMeta, TECH_RESEARCH_TASK_KIND } from '../../game/techResearchCatalog.mjs';
import { CAMP_MAINTENANCE_TASK_KIND } from '../../game/campMaintenance.mjs';

export function humanizeDebriefTaskKind(kind) {
  if (typeof kind !== 'string' || !kind) {
    return 'Task';
  }
  return kind.replace(/_/g, ' ');
}

/**
 * @param {Record<string, unknown>} task
 * @param {(id: string) => string} formatTokenLabel
 */
export function partnerQueueTaskTitle(task, formatTokenLabel) {
  if (!task || typeof task !== 'object') {
    return 'Task';
  }
  const kind = typeof task.kind === 'string' ? task.kind : '';
  if (kind === TECH_RESEARCH_TASK_KIND) {
    const uk = typeof task.meta?.unlockKey === 'string' ? task.meta.unlockKey : '';
    if (uk) {
      const meta = getTechResearchMeta(uk);
      return `${meta.label || formatTokenLabel(uk)} (tech research)`;
    }
    return 'Tech research';
  }
  if (kind === CAMP_MAINTENANCE_TASK_KIND) {
    return 'Camp maintenance';
  }
  if (task.meta?.source === 'stockpile_process' && typeof task.meta.itemId === 'string') {
    return `${humanizeDebriefTaskKind(kind)}: ${formatTokenLabel(task.meta.itemId)}`;
  }
  return humanizeDebriefTaskKind(kind);
}

/**
 * @param {Record<string, unknown>} entry
 * @param {(id: string) => string} formatTokenLabel
 */
export function partnerHistorySummaryLine(entry, formatTokenLabel) {
  const kind = typeof entry?.kind === 'string' ? entry.kind : '';
  const status = typeof entry?.status === 'string' ? entry.status : '';
  const meta = entry?.meta && typeof entry.meta === 'object' ? entry.meta : {};
  const title = partnerQueueTaskTitle({ kind, meta }, formatTokenLabel);
  const day = Number.isInteger(entry?.day) ? entry.day : null;
  const dayBit = day != null ? `Day ${day}: ` : '';
  const fail = typeof entry?.failureReason === 'string' && entry.failureReason ? ` (${entry.failureReason})` : '';
  return `${dayBit}${title} — ${status}${fail}`;
}
