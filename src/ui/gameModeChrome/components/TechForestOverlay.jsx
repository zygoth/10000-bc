import { useMemo, useState, useCallback } from 'react';
import {
  getTechResearchMeta,
  TECH_FOREST_FILTER_GROUPS,
  TECH_RESEARCH_TASK_KIND,
} from '../../../game/techResearchCatalog.mjs';
import {
  getTechForestChildResearchBlocker,
  isTechResearchDisplayComplete,
} from '../../../game/techForestGen.mjs';

function collectQueuedTechKeys(activeTask, pendingTasks) {
  const keys = new Set();
  const visit = (t) => {
    if (t?.kind === TECH_RESEARCH_TASK_KIND && typeof t.meta?.unlockKey === 'string') {
      keys.add(t.meta.unlockKey);
    }
  };
  if (activeTask) {
    visit(activeTask);
  }
  if (Array.isArray(pendingTasks)) {
    for (const t of pendingTasks) {
      visit(t);
    }
  }
  return keys;
}

export default function TechForestOverlay({
  techForest,
  techUnlocks,
  techUnlockVisionGranted = null,
  techUnlockPartnerResearch = null,
  queueActiveTask,
  queuePendingTasks,
  onQueueTechResearch,
  onClose,
  isDebriefActive = false,
}) {
  const [filterId, setFilterId] = useState('all');
  const [selectedKey, setSelectedKey] = useState(null);

  const queuedKeys = useMemo(
    () => collectQueuedTechKeys(queueActiveTask, queuePendingTasks),
    [queueActiveTask, queuePendingTasks],
  );

  const trees = useMemo(
    () => (Array.isArray(techForest?.trees) ? techForest.trees : []),
    [techForest],
  );

  const techDisplaySources = useMemo(
    () => ({
      visionGranted: techUnlockVisionGranted && typeof techUnlockVisionGranted === 'object'
        ? techUnlockVisionGranted
        : null,
      partnerResearched: techUnlockPartnerResearch && typeof techUnlockPartnerResearch === 'object'
        ? techUnlockPartnerResearch
        : null,
    }),
    [techUnlockVisionGranted, techUnlockPartnerResearch],
  );

  const nodeMatchesFilter = useCallback((unlockKey) => {
    if (filterId === 'all') {
      return true;
    }
    const group = TECH_FOREST_FILTER_GROUPS.find((g) => g.id === filterId);
    const tag = group?.tag;
    if (!tag) {
      return true;
    }
    const meta = getTechResearchMeta(unlockKey);
    return Array.isArray(meta.tags) && meta.tags.includes(tag);
  }, [filterId]);

  const describeNodeStatus = useCallback((node) => {
    const { unlockKey, parentUnlockKey } = node;
    if (isTechResearchDisplayComplete(techForest, techUnlocks, unlockKey, techDisplaySources)) {
      return { label: 'Researched', className: 'tech-forest-status--done' };
    }
    if (techUnlocks?.[unlockKey] === true) {
      return {
        label: 'Insight — finish prerequisite research first',
        className: 'tech-forest-status--avail',
      };
    }
    if (parentUnlockKey) {
      const childBlock = getTechForestChildResearchBlocker(
        techForest,
        techUnlocks,
        parentUnlockKey,
        techDisplaySources.visionGranted,
        techDisplaySources.partnerResearched,
      );
      if (childBlock) {
        if (childBlock.reason === 'vision_parent') {
          const pMeta = getTechResearchMeta(childBlock.blockerKey);
          return {
            label: `Locked — research ${pMeta.label || childBlock.blockerKey} at camp (vision alone does not open this branch)`,
            className: 'tech-forest-status--locked',
          };
        }
        const blockerMeta = getTechResearchMeta(childBlock.blockerKey);
        return {
          label: `Locked — requires ${blockerMeta.label || childBlock.blockerKey}`,
          className: 'tech-forest-status--locked',
        };
      }
    }
    return { label: 'Available', className: 'tech-forest-status--avail' };
  }, [techForest, techUnlocks, techDisplaySources]);

  let selectedNode = null;
  if (selectedKey && techForest?.byUnlockKey?.[selectedKey]) {
    for (const tree of trees) {
      const found = (tree.nodes || []).find((n) => n.unlockKey === selectedKey);
      if (found) {
        selectedNode = found;
        break;
      }
    }
  }

  const childBlockForSelected = selectedNode?.parentUnlockKey
    ? getTechForestChildResearchBlocker(
      techForest,
      techUnlocks,
      selectedNode.parentUnlockKey,
      techDisplaySources.visionGranted,
      techDisplaySources.partnerResearched,
    )
    : null;

  const solidifyVisionTarget = selectedNode
    && techUnlocks?.[selectedNode.unlockKey] === true
    && techDisplaySources.visionGranted?.[selectedNode.unlockKey] === true
    && techDisplaySources.partnerResearched?.[selectedNode.unlockKey] !== true;

  const canQueueSelected = selectedNode
    && !childBlockForSelected
    && !queuedKeys.has(selectedNode.unlockKey)
    && (
      solidifyVisionTarget
      || techUnlocks?.[selectedNode.unlockKey] !== true
    );

  return (
    <div
      className={`tech-forest-overlay${isDebriefActive ? ' tech-forest-overlay--debrief' : ''}`}
      role="dialog"
      aria-label="Tech Forest"
    >
      <div className="tech-forest-panel tech-forest-panel--wide">
        <header className="tech-forest-header">
          <h2>Tech Forest</h2>
          <button type="button" className="tech-forest-close" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="debrief-note tech-forest-hint">
          All nodes are visible from the start. Research at camp unlocks recipes; queue partner tasks below.
        </p>

        <div className="tech-forest-filters" role="tablist" aria-label="Tech categories">
          {TECH_FOREST_FILTER_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={filterId === g.id}
              className={`tech-forest-filter-btn ${filterId === g.id ? 'active' : ''}`}
              onClick={() => setFilterId(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="tech-forest-trees">
          {trees.map((tree) => (
            <div key={`tree-${tree.id}`} className="tech-forest-tree-col">
              <h3 className="tech-forest-tree-title">Tree {tree.id + 1}</h3>
              <ol className="tech-forest-chain">
                {(tree.nodes || []).map((node) => {
                  const meta = getTechResearchMeta(node.unlockKey);
                  const status = describeNodeStatus(node);
                  const filtered = nodeMatchesFilter(node.unlockKey);
                  const queued = queuedKeys.has(node.unlockKey);
                  return (
                    <li
                      key={node.unlockKey}
                      className={`tech-forest-node ${filtered ? '' : 'tech-forest-node--dim'} ${selectedKey === node.unlockKey ? 'tech-forest-node--selected' : ''}`}
                    >
                      <button
                        type="button"
                        className="tech-forest-node-btn"
                        onClick={() => setSelectedKey(node.unlockKey)}
                      >
                        <span className="tech-forest-node-name">{meta.label}</span>
                        <span className="tech-forest-node-ticks">{node.researchTicks} ticks</span>
                        <span className={`tech-forest-status ${status.className}`}>{status.label}</span>
                        {queued ? <span className="tech-forest-badge">Queued</span> : null}
                        {isTechResearchDisplayComplete(techForest, techUnlocks, node.unlockKey, techDisplaySources) ? (
                          <span className="tech-forest-badge tech-forest-badge--done">Complete</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>

        {selectedNode ? (
          <div className="tech-forest-detail">
            <h4>{getTechResearchMeta(selectedNode.unlockKey).label}</h4>
            <p className="debrief-note">
              Research cost: {selectedNode.researchTicks} ticks
              {selectedNode.parentUnlockKey ? (
                <>
                  {' '}
                  · Prerequisite:{' '}
                  {getTechResearchMeta(selectedNode.parentUnlockKey).label}
                </>
              ) : (
                ' · No prerequisite (root)'
              )}
            </p>
            <div className="tech-forest-detail-actions">
              {typeof onQueueTechResearch === 'function' ? (
                <button
                  type="button"
                  disabled={!canQueueSelected}
                  onClick={() => {
                    onQueueTechResearch(selectedNode.unlockKey, selectedNode.researchTicks);
                  }}
                >
                  Add to partner queue
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
