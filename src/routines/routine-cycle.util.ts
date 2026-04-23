/**
 * RoutineCycleUtil
 *
 * Centralised helpers that understand both daily and weekly routine cycles.
 * Every service that needs to decide "was this missed?" or "should the streak
 * grow?" must go through these helpers so the logic stays consistent.
 */

/**
 * Returns the zero-indexed cycle number for a given calendar date.
 *   daily  → each day is its own cycle (cycle index = days since startDate)
 *   weekly → every 7 days from startDate is one cycle
 *
 * Returns -1 if `checkDate` is before `startDate`.
 */
export function getCycleIndex(frequencyType: string, startDate: string, checkDate: string): number {
  const start = new Date(startDate + 'T00:00:00Z');
  const check = new Date(checkDate + 'T00:00:00Z');
  const diffDays = Math.floor((check.getTime() - start.getTime()) / 86_400_000);

  if (diffDays < 0) return -1;

  if (frequencyType.toLowerCase() === 'weekly') {
    return Math.floor(diffDays / 7);
  }
  // daily (default)
  return diffDays;
}

/**
 * Returns the cycle index for the cycle that was "due" on a given date.
 * For daily routines this is the same as getCycleIndex(checkDate).
 * For weekly routines this is the index of the week that ended on or before checkDate.
 *
 * Returns -1 if checkDate is before startDate.
 */
export function getDueCycleIndex(
  frequencyType: string,
  startDate: string,
  checkDate: string,
): number {
  return getCycleIndex(frequencyType, startDate, checkDate);
}

/**
 * Returns true if the routine was missed on `checkDate`.
 *
 * For daily:  missed if lastCompletedDate is NOT checkDate (and the routine
 *             had already started).
 * For weekly: missed if lastCompletedDate falls in an EARLIER cycle than the
 *             one that checkDate belongs to (meaning the cycle that just ended
 *             was never completed).
 *
 * `joinedAt` (YYYY-MM-DD) is used to skip penalties for days/weeks before
 * the member joined.
 */
export function isMissed(
  frequencyType: string,
  startDate: string,
  lastCompletedDate: string | null,
  checkDate: string,
  joinedAt?: string,
): boolean {
  // Not yet started
  if (checkDate < startDate) return false;

  // Member hadn't joined yet on checkDate
  if (joinedAt && checkDate < joinedAt) return false;

  const freq = frequencyType.toLowerCase();

  if (freq === 'daily') {
    return lastCompletedDate !== checkDate;
  }

  if (freq === 'weekly') {
    const effectiveStart = joinedAt && joinedAt > startDate ? joinedAt : startDate;
    const dueCycle = getDueCycleIndex(freq, startDate, checkDate);
    // If the member joined mid-cycle, don't penalise for that first partial cycle
    const joinCycle = getDueCycleIndex(freq, startDate, effectiveStart);
    if (dueCycle <= joinCycle) return false;

    if (!lastCompletedDate) return true;
    const completedCycle = getDueCycleIndex(freq, startDate, lastCompletedDate);
    return completedCycle < dueCycle;
  }

  return false;
}

/**
 * Returns true if completing the routine on `completionDate` should increment
 * the member's streak (as opposed to resetting it to 1 or leaving it alone).
 *
 * For daily:  streak increments if lastCompletedDate was yesterday.
 * For weekly: streak increments if lastCompletedDate falls in the PREVIOUS cycle.
 */
export function shouldIncrementStreak(
  frequencyType: string,
  startDate: string,
  lastCompletedDate: string | null,
  completionDate: string,
): boolean {
  if (!lastCompletedDate) return false;

  const freq = frequencyType.toLowerCase();

  if (freq === 'daily') {
    const prev = new Date(completionDate + 'T00:00:00Z');
    prev.setUTCDate(prev.getUTCDate() - 1);
    const yesterdayStr = prev.toISOString().split('T')[0];
    return lastCompletedDate === yesterdayStr;
  }

  if (freq === 'weekly') {
    const currentCycle = getCycleIndex(freq, startDate, completionDate);
    const lastCycle = getCycleIndex(freq, startDate, lastCompletedDate);
    return lastCycle === currentCycle - 1;
  }

  return false;
}

/**
 * Returns true if the streak should be reset to 0 because at least one full
 * cycle has been skipped since `lastCompletedDate`.
 *
 * This drives the "lazy streak sync" — call it on read to make the streak
 * look correct even when the background job hasn't run yet.
 */
export function isStreakBroken(
  frequencyType: string,
  startDate: string,
  lastCompletedDate: string | null,
  currentDate: string,
): boolean {
  if (!lastCompletedDate) return false;

  const freq = frequencyType.toLowerCase();

  if (freq === 'daily') {
    const prev = new Date(currentDate + 'T00:00:00Z');
    prev.setUTCDate(prev.getUTCDate() - 1);
    const yesterdayStr = prev.toISOString().split('T')[0];
    // Broken if not completed today OR yesterday
    return lastCompletedDate !== currentDate && lastCompletedDate !== yesterdayStr;
  }

  if (freq === 'weekly') {
    const currentCycle = getCycleIndex(freq, startDate, currentDate);
    const lastCycle = getCycleIndex(freq, startDate, lastCompletedDate);
    // Broken if the last completion is 2+ cycles ago (current cycle AND previous cycle both missed)
    return currentCycle - lastCycle >= 2;
  }

  return false;
}

/**
 * Returns true if the routine was completed within the current active cycle.
 * For daily: completed today.
 * For weekly: completed within the current 7-day week (starting from startDate).
 */
export function isCompletedInCurrentCycle(
  frequencyType: string,
  startDate: string,
  lastCompletedDate: string | null,
  currentDate: string,
): boolean {
  if (!lastCompletedDate) return false;

  const freq = frequencyType.toLowerCase();
  const currentCycle = getCycleIndex(freq, startDate, currentDate);
  const lastCycle = getCycleIndex(freq, startDate, lastCompletedDate);

  return currentCycle === lastCycle;
}
