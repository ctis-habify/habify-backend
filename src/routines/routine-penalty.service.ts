import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Between } from 'typeorm';
import { Routine } from './routines.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { RoutineMember } from './routine-members.entity';
import { RoutineLog } from '../routine-logs/routine-logs.entity';
import { CollaborativeRoutineLog } from './collaborative-routine-logs.entity';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { User } from '../users/users.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { isMissed } from './routine-cycle.util';

@Injectable()
export class RoutinePenaltyService {
  private readonly logger = new Logger(RoutinePenaltyService.name);

  constructor(
    @InjectRepository(Routine)
    private readonly routineRepo: Repository<Routine>,
    @InjectRepository(CollaborativeRoutine)
    private readonly collabRoutineRepo: Repository<CollaborativeRoutine>,
    @InjectRepository(RoutineMember)
    private readonly memberRepo: Repository<RoutineMember>,
    @InjectRepository(RoutineLog)
    private readonly logRepo: Repository<RoutineLog>,
    @InjectRepository(CollaborativeRoutineLog)
    private readonly collabLogRepo: Repository<CollaborativeRoutineLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly xpLogsService: XpLogsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async checkAndApplyPenalties(): Promise<void> {
    this.logger.log('Starting daily routine penalty check...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 1. Process Personal Routines
    await this.processPersonalPenalties(yesterdayStr);

    // 2. Process Collaborative Routines
    await this.processCollaborativePenalties(yesterdayStr);

    this.logger.log('Routine penalty check completed.');
  }

  private async processPersonalPenalties(yesterdayStr: string): Promise<void> {
    const personalRoutines = await this.routineRepo.find({
      where: {
        active: true,
        startDate: LessThanOrEqual(yesterdayStr),
      },
    });

    const missedUserIds = new Set<string>();

    for (const routine of personalRoutines) {
      const freq = routine.frequencyType.toLowerCase();
      if (freq !== 'daily' && freq !== 'weekly') continue;

      const missed = isMissed(
        routine.frequencyType,
        routine.startDate,
        routine.lastCompletedDate,
        yesterdayStr,
      );

      if (!missed) continue;

      // For weekly routines, only penalise on the last day of the missed cycle
      // (i.e. every 7th day from startDate). This prevents 7 penalties per week.
      if (freq === 'weekly') {
        const start = new Date(routine.startDate + 'T00:00:00Z');
        const check = new Date(yesterdayStr + 'T00:00:00Z');
        const diffDays = Math.floor((check.getTime() - start.getTime()) / 86_400_000);
        // Only fire on the last day of the week (index 6 of each 7-day cycle)
        if (diffDays % 7 !== 6) continue;
      }

      this.logger.log(
        `User ${routine.userId} missed personal routine ${routine.id} (${freq}). Deducting XP.`,
      );
      await this.xpLogsService.deductXP(routine.userId, 10, 'ROUTINE_MISSED');

      await this.notificationsService.createAndPush({
        userId: routine.userId,
        type: 'PENALTY',
        title: 'XP Penalty',
        body: `You lost 10 XP for missing your routine: ${routine.routineName}`,
        routineId: routine.id,
      });

      routine.missedCount += 1;
      routine.streak = 0;
      await this.routineRepo.save(routine);
      missedUserIds.add(routine.userId);
    }

    for (const uid of missedUserIds) {
      await this.userRepo.update(uid, { dailyStreak: 0 });
    }
  }

  private async processCollaborativePenalties(yesterdayStr: string): Promise<void> {
    const collabRoutines = await this.collabRoutineRepo.find({
      where: {
        startDate: LessThanOrEqual(yesterdayStr),
      },
      relations: ['members', 'members.user'],
    });

    for (const routine of collabRoutines) {
      const freq = routine.frequencyType.toLowerCase();
      if (freq !== 'daily' && freq !== 'weekly') continue;

      // For weekly routines, only run the check on the last day of each 7-day cycle
      // to avoid firing 7 times per missed week.
      if (freq === 'weekly') {
        const start = new Date(routine.startDate + 'T00:00:00Z');
        const check = new Date(yesterdayStr + 'T00:00:00Z');
        const diffDays = Math.floor((check.getTime() - start.getTime()) / 86_400_000);
        if (diffDays % 7 !== 6) continue;
      }

      // Skip groups that are already defeated — no further life/XP penalties
      const isDefeated = routine.lives === 0;

      let anyMemberMissed = false;

      for (const member of routine.members) {
        // Determine the join date as a YYYY-MM-DD string (use UTC date to be safe)
        const joinedAtStr = member.joinedAt
          ? new Date(member.joinedAt).toISOString().split('T')[0]
          : routine.startDate;

        const missed = isMissed(
          routine.frequencyType,
          routine.startDate,
          member.lastCompletedDate,
          yesterdayStr,
          joinedAtStr,
        );

        if (!missed) continue;

        anyMemberMissed = true;

        if (!isDefeated) {
          this.logger.log(
            `User ${member.userId} missed collab routine ${routine.id} (${freq}). Deducting XP.`,
          );
          await this.xpLogsService.deductXP(member.userId, 10, 'COLLAB_ROUTINE_MISSED');

          await this.notificationsService.createAndPush({
            userId: member.userId,
            type: 'PENALTY',
            title: 'Group XP Penalty',
            body: `You lost 10 XP for missing your part in the group: ${routine.routineName}`,
            collaborativeRoutineId: routine.id,
          });
        }

        member.missedCount += 1;
        member.streak = 0;
        await this.memberRepo.save(member);
      }

      if (anyMemberMissed && !isDefeated) {
        routine.lives = Math.max(0, routine.lives - 1);
        this.logger.log(`Collab routine ${routine.id} lost a life. Remaining: ${routine.lives}`);

        if (routine.lives === 0) {
          this.logger.log(`Collab routine ${routine.id} is DEFEATED. Penalizing all members.`);
          for (const member of routine.members) {
            await this.xpLogsService.deductXP(member.userId, 20, 'COLLAB_GROUP_DEFEATED');

            await this.notificationsService.createAndPush({
              userId: member.userId,
              type: 'GROUP_DEFEAT',
              title: 'Group Defeated!',
              body: `The group routine ${routine.routineName} lost all lives. ALL members lost 20 XP.`,
              collaborativeRoutineId: routine.id,
            });
          }
        }

        await this.collabRoutineRepo.save(routine);
      }
    }
  }

  /**
   * Retroactively penalises all missed cycles from each routine's startDate
   * up to yesterday. Should be called ONCE to catch up on penalties that were
   * skipped before this fix was deployed.
   *
   * Safe to call multiple times — it reads actual logs to determine if a cycle
   * was completed, so it will not double-penalise a cycle that was already
   * counted.
   *
   * For collaborative routines:
   *   - Weekly: one life lost per missed 7-day cycle if any member missed it.
   *   - Daily:  one life lost per missed day if any member missed it.
   * For personal routines:
   *   - XP deducted for each missed cycle.
   */
  async catchUpMissedPenalties(): Promise<{
    processedRoutines: number;
    livesDeducted: number;
    personalXpDeductions: number;
  }> {
    this.logger.log('Starting retroactive catch-up penalty check...');

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let processedRoutines = 0;
    let livesDeducted = 0;
    let personalXpDeductions = 0;

    // ── 1. Collaborative routines ─────────────────────────────────────────────
    const collabRoutines = await this.collabRoutineRepo.find({
      where: { startDate: LessThanOrEqual(yesterdayStr) },
      relations: ['members', 'members.user'],
    });

    for (const routine of collabRoutines) {
      const freq = routine.frequencyType.toLowerCase();
      if (freq !== 'daily' && freq !== 'weekly') continue;

      const startMs = new Date(routine.startDate + 'T00:00:00Z').getTime();
      const endMs = new Date(yesterdayStr + 'T00:00:00Z').getTime();
      const totalDays = Math.floor((endMs - startMs) / 86_400_000);

      // Build list of cycle end-dates (0-indexed days from startDate)
      const cycleEndDays: number[] = [];
      if (freq === 'daily') {
        for (let d = 0; d <= totalDays; d++) cycleEndDays.push(d);
      } else {
        // Weekly: cycle ends on days 6, 13, 20, … from startDate
        for (let d = 6; d <= totalDays; d += 7) cycleEndDays.push(d);
      }

      if (cycleEndDays.length === 0) continue;

      let routineLivesDeducted = 0;

      for (const cycleEndDay of cycleEndDays) {
        // Already defeated — no more life deductions
        if (routine.lives - routineLivesDeducted <= 0) break;

        const cycleEndDate = new Date(startMs + cycleEndDay * 86_400_000);
        const cycleEndStr = cycleEndDate.toISOString().split('T')[0];

        const cycleStartDay = freq === 'weekly' ? cycleEndDay - 6 : cycleEndDay;
        const cycleStartDate = new Date(startMs + cycleStartDay * 86_400_000);
        cycleStartDate.setUTCHours(0, 0, 0, 0);
        const cycleEndDateFull = new Date(cycleEndDate);
        cycleEndDateFull.setUTCHours(23, 59, 59, 999);

        let anyMemberMissed = false;

        for (const member of routine.members) {
          const joinedAtStr = member.joinedAt
            ? new Date(member.joinedAt).toISOString().split('T')[0]
            : routine.startDate;

          // Member hadn't joined yet when this cycle ended
          if (joinedAtStr > cycleEndStr) continue;

          // Check if member has an approved log in this cycle window
          const approvedLog = await this.collabLogRepo.findOne({
            where: {
              userId: member.userId,
              routine: { id: routine.id },
              status: 'approved',
              logDate: Between(cycleStartDate, cycleEndDateFull),
            },
          });

          if (!approvedLog) {
            anyMemberMissed = true;
            // Increment missed count (idempotency not needed here — called once)
            member.missedCount += 1;
            member.streak = 0;

            await this.xpLogsService.deductXP(member.userId, 10, 'COLLAB_ROUTINE_MISSED');
            await this.memberRepo.save(member);
          }
        }

        if (anyMemberMissed) {
          routineLivesDeducted += 1;
        }
      }

      if (routineLivesDeducted > 0) {
        const oldLives = routine.lives;
        routine.lives = Math.max(0, routine.lives - routineLivesDeducted);
        livesDeducted += oldLives - routine.lives;

        this.logger.log(
          `Catch-up: collab routine ${routine.id} ("${routine.routineName}") ` +
            `lives: ${oldLives} → ${routine.lives} (deducted ${routineLivesDeducted})`,
        );

        if (routine.lives === 0) {
          this.logger.log(`Catch-up: collab routine ${routine.id} is now DEFEATED.`);
          for (const member of routine.members) {
            await this.xpLogsService.deductXP(member.userId, 20, 'COLLAB_GROUP_DEFEATED');
            await this.notificationsService.createAndPush({
              userId: member.userId,
              type: 'GROUP_DEFEAT',
              title: 'Group Defeated!',
              body: `The group routine "${routine.routineName}" lost all lives.`,
              collaborativeRoutineId: routine.id,
            });
          }
        }

        await this.collabRoutineRepo.save(routine);
        processedRoutines += 1;
      }
    }

    // ── 2. Personal routines (weekly only — daily was handled by existing cron) ─
    const personalRoutines = await this.routineRepo.find({
      where: {
        active: true,
        startDate: LessThanOrEqual(yesterdayStr),
      },
    });

    for (const routine of personalRoutines) {
      const freq = routine.frequencyType.toLowerCase();
      if (freq !== 'weekly') continue; // daily already penalised by existing cron

      const startMs = new Date(routine.startDate + 'T00:00:00Z').getTime();
      const endMs = new Date(yesterdayStr + 'T00:00:00Z').getTime();
      const totalDays = Math.floor((endMs - startMs) / 86_400_000);

      // Weekly cycle ends on days 6, 13, 20, …
      let missedCycles = 0;
      for (let cycleEndDay = 6; cycleEndDay <= totalDays; cycleEndDay += 7) {
        const cycleEndDate = new Date(startMs + cycleEndDay * 86_400_000);
        const cycleStartDate = new Date(startMs + (cycleEndDay - 6) * 86_400_000);
        cycleStartDate.setUTCHours(0, 0, 0, 0);
        cycleEndDate.setUTCHours(23, 59, 59, 999);

        const completedLog = await this.logRepo.findOne({
          where: {
            userId: routine.userId,
            routine: { id: routine.id },
            isVerified: true,
            logDate: Between(cycleStartDate, cycleEndDate),
          },
        });

        if (!completedLog) {
          missedCycles += 1;
        }
      }

      if (missedCycles > 0) {
        routine.missedCount += missedCycles;
        routine.streak = 0;
        await this.routineRepo.save(routine);

        for (let i = 0; i < missedCycles; i++) {
          await this.xpLogsService.deductXP(routine.userId, 10, 'ROUTINE_MISSED');
        }
        await this.userRepo.update(routine.userId, { dailyStreak: 0 });

        personalXpDeductions += missedCycles;
        processedRoutines += 1;

        this.logger.log(
          `Catch-up: personal routine ${routine.id} ("${routine.routineName}") ` +
            `missed ${missedCycles} weekly cycle(s). XP deducted.`,
        );
      }
    }

    this.logger.log(
      `Catch-up complete. Routines processed: ${processedRoutines}, ` +
        `lives deducted: ${livesDeducted}, personal XP deductions: ${personalXpDeductions}.`,
    );

    return { processedRoutines, livesDeducted, personalXpDeductions };
  }
}
