import { isCompletedInCurrentCycle } from './routine-cycle.util';

describe('RoutineCycleUtil - isCompletedInCurrentCycle', () => {
  const startDate = '2026-04-20'; // A Monday

  describe('Daily frequency', () => {
    const freq = 'daily';

    it('should return true if completed today', () => {
      const today = '2026-04-24';
      const lastDone = '2026-04-24';
      expect(isCompletedInCurrentCycle(freq, startDate, lastDone, today)).toBe(true);
    });

    it('should return false if completed yesterday', () => {
      const today = '2026-04-24';
      const lastDone = '2026-04-23';
      expect(isCompletedInCurrentCycle(freq, startDate, lastDone, today)).toBe(false);
    });

    it('should return false if never completed', () => {
      const today = '2026-04-24';
      expect(isCompletedInCurrentCycle(freq, startDate, null, today)).toBe(false);
    });
  });

  describe('Weekly frequency', () => {
    const freq = 'weekly';

    it('should return true if completed within the same week cycle', () => {
      // Week 0: 2026-04-20 to 2026-04-26
      const monday = '2026-04-20';
      const friday = '2026-04-24';
      expect(isCompletedInCurrentCycle(freq, startDate, monday, friday)).toBe(true);
    });

    it('should return false if completed in the previous week cycle', () => {
      const lastSunday = '2026-04-19';
      const thisMonday = '2026-04-20';
      expect(isCompletedInCurrentCycle(freq, startDate, lastSunday, thisMonday)).toBe(false);
    });

    it('should return false if checked on the first day of the next week cycle', () => {
      const thisMonday = '2026-04-20';
      const nextMonday = '2026-04-27';
      expect(isCompletedInCurrentCycle(freq, startDate, thisMonday, nextMonday)).toBe(false);
    });
  });
});
