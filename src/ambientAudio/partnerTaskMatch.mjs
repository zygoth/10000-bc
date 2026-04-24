/**
 * @param {object} entry catalog entry with task_match
 * @param {object|null} activeTask camp.partnerTaskQueue.active
 */
export function partnerTaskMatches(entry, activeTask) {
  if (!activeTask || typeof activeTask !== 'object') {
    return false;
  }
  const m = entry?.task_match;
  if (!m || typeof m !== 'object') {
    return false;
  }
  if (typeof m.task_kind === 'string' && m.task_kind !== activeTask.kind) {
    return false;
  }
  if (m.meta && typeof m.meta === 'object') {
    const meta = activeTask.meta && typeof activeTask.meta === 'object' ? activeTask.meta : {};
    for (const [k, v] of Object.entries(m.meta)) {
      if (meta[k] !== v) {
        return false;
      }
    }
  }
  return true;
}
