import {
  annotateContextEntryTickBudget,
  formatWeightLabel,
  getCarryWeightSeverity,
  getSelectedStackEntry,
  getActiveItemContextEntries,
  getWorstSeverity,
} from './GameModeChromeDisplayLogic.js';

describe('gameModeChrome display logic', () => {
  test('formatWeightLabel formats tiny weights in grams', () => {
    expect(formatWeightLabel(0.001)).toBe('1g');
    expect(formatWeightLabel('0.015')).toBe('15g');
  });

  test('formatWeightLabel formats >= 0.1kg with fixed decimals', () => {
    expect(formatWeightLabel(1.2)).toBe('1.20kg');
  });

  test('getCarryWeightSeverity returns normal/warning/critical based on ratio', () => {
    expect(getCarryWeightSeverity({ currentKg: 0, capacityKg: 10 })).toBe('normal');
    expect(getCarryWeightSeverity({ currentKg: 8, capacityKg: 10 })).toBe('warning');
    expect(getCarryWeightSeverity({ currentKg: 9.5, capacityKg: 10 })).toBe('critical');
  });

  test('getSelectedStackEntry returns null when missing', () => {
    expect(getSelectedStackEntry(null, 'x')).toBeNull();
    expect(getSelectedStackEntry([], 'x')).toBeNull();
    expect(getSelectedStackEntry([{ itemId: 'a' }], '')).toBeNull();
  });

  test('getSelectedStackEntry finds stack by itemId', () => {
    const stacks = [{ itemId: 'a', name: 'A' }, { itemId: 'b', name: 'B' }];
    expect(getSelectedStackEntry(stacks, 'b')).toEqual({ itemId: 'b', name: 'B' });
  });

  test('getActiveItemContextEntries picks entries by source', () => {
    const inventoryQuickActionsByStackIndex = [
      [{ kind: 'eat', label: 'Eat', payload: {} }],
    ];
    const stockpileQuickActionsByItemId = {
      apple: [{ kind: 'stash', label: 'Stash', payload: {} }],
    };

    expect(getActiveItemContextEntries({
      itemContextMenu: null,
      inventoryQuickActionsByStackIndex,
      stockpileQuickActionsByItemId,
    })).toEqual([]);

    expect(getActiveItemContextEntries({
      itemContextMenu: { source: 'inventory', itemId: 'apple', inventoryStackIndex: 0 },
      inventoryQuickActionsByStackIndex,
      stockpileQuickActionsByItemId,
    })).toEqual([{ kind: 'eat', label: 'Eat', payload: {} }]);

    expect(getActiveItemContextEntries({
      itemContextMenu: { source: 'stockpile', itemId: 'apple' },
      inventoryQuickActionsByStackIndex,
      stockpileQuickActionsByItemId,
    })).toEqual([{ kind: 'stash', label: 'Stash', payload: {} }]);
  });

  test('getWorstSeverity returns worst severity in group rows', () => {
    expect(getWorstSeverity([])).toBe('good');
    expect(getWorstSeverity([{ severity: 'good' }, { severity: 'warning' }])).toBe('warning');
    expect(getWorstSeverity([{ severity: 'warning' }, { severity: 'critical' }])).toBe('critical');
    expect(getWorstSeverity([{ severity: 'low' }, { severity: 'warning' }])).toBe('low');
  });

  test('annotateContextEntryTickBudget warns on overdraft within limit', () => {
    const player = { tickBudgetCurrent: 5, tickBudgetBase: 200 };
    const out = annotateContextEntryTickBudget({ kind: 'x', label: 'Do', tickCost: 10, payload: {} }, player);
    expect(out.tickOverdraftWarning).toBe(true);
    expect(out.disabled).toBeUndefined();
  });

  test('annotateContextEntryTickBudget disables when spend would pass out', () => {
    const player = { tickBudgetCurrent: 5, tickBudgetBase: 200 };
    const out = annotateContextEntryTickBudget({ kind: 'x', label: 'Long', tickCost: 50, payload: {} }, player);
    expect(out.disabled).toBe(true);
    expect(typeof out.disabledReason).toBe('string');
  });

  test('annotateContextEntryTickBudget merges pass-out reason with existing disabledReason', () => {
    const player = { tickBudgetCurrent: 2, tickBudgetBase: 200 };
    const out = annotateContextEntryTickBudget({
      kind: 'x',
      label: 'X',
      tickCost: 50,
      payload: {},
      disabled: true,
      disabledReason: 'Too heavy.',
    }, player);
    expect(out.disabled).toBe(true);
    expect(out.disabledReason).toContain('Too heavy.');
    expect(out.disabledReason.length).toBeGreaterThan('Too heavy.'.length);
  });
});

