import { getTechForestEntrySurface } from './TechForestDisplayLogic.js';

describe('TechForestDisplayLogic', () => {
  test('play HUD entrypoint when not in debrief', () => {
    const play = getTechForestEntrySurface({ isDebriefActive: false });
    expect(play.showInPlayHud).toBe(true);
    expect(play.showInDebrief).toBe(false);
    expect(play.showInDebriefQueueTab).toBe(false);
  });

  test('debrief entrypoint on queue tab', () => {
    const debriefQueue = getTechForestEntrySurface({ isDebriefActive: true, debriefSelectedTab: 'queue' });
    expect(debriefQueue.showInPlayHud).toBe(false);
    expect(debriefQueue.showInDebrief).toBe(true);
    expect(debriefQueue.showInDebriefQueueTab).toBe(true);
  });

  test('debrief open but not on queue: no queue-tab shortcut', () => {
    const meal = getTechForestEntrySurface({ isDebriefActive: true, debriefSelectedTab: 'meal' });
    expect(meal.showInDebrief).toBe(true);
    expect(meal.showInDebriefQueueTab).toBe(false);
  });
});
