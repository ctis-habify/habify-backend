import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { PersonalRoutine } from './routines.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { CollaborativeRoutineMember } from './routine-members.entity';
import { PersonalRoutineLog } from '../routine-logs/routine-logs.entity';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { User } from '../users/users.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { isMissed } from './routine-cycle.util';

@Injectable()
export class RoutinePenaltyService {
  private readonly logger = new Logger(RoutinePenaltyService.name);

  constructor(
    @InjectRepository(PersonalRoutine)
    private readonly routineRepo: Repository<PersonalRoutine>,
    @InjectRepository(CollaborativeRoutine)
    private readonly collabRoutineRepo: Repository<CollaborativeRoutine>,
    @InjectRepository(CollaborativeRoutineMember)
    private readonly memberRepo: Repository<CollaborativeRoutineMember>,
    @InjectRepository(PersonalRoutineLog)
    private readonly logRepo: Repository<PersonalRoutineLog>,
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

    this.logger.log('Personal PersonalRoutine penalty check completed.');
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

          await this.collabRoutineRepo.save(routine);

          // Handle creator defeat: remove creator or delete routine
          await this.applyCreatorDefeat(routine);
        } else {
          await this.collabRoutineRepo.save(routine);
        }
      }
    }
  }

  /**
   * Handles the creator's fate when a collaborative routine is defeated.
   * - Sole member  → routine is deleted entirely.
   * - Other members exist → creator is removed and a random member is promoted.
   */
  private async applyCreatorDefeat(routine: CollaborativeRoutine): Promise<void> {
    // Re-fetch members to get the latest list
    const members = await this.memberRepo.find({
      where: { collaborativeRoutineId: routine.id },
    });

    if (members.length <= 1) {
      await this.collabRoutineRepo.delete(routine.id);
      this.logger.log(`Collaborative PersonalRoutine ${routine.id} deleted: creator was the sole member after defeat.`);
      return;
    }

    const creatorMembership = members.find((m) => m.role === 'creator');
    if (!creatorMembership) return;

    const otherMembers = members.filter((m) => m.role !== 'creator');
    const newCreator = otherMembers[Math.floor(Math.random() * otherMembers.length)];

    newCreator.role = 'creator';
    await this.memberRepo.save(newCreator);

    routine.creatorId = newCreator.userId;
    await this.collabRoutineRepo.save(routine);

    await this.memberRepo.remove(creatorMembership);

    this.logger.log(
      `Collaborative PersonalRoutine ${routine.id}: creator removed after defeat, ` +
        `new creator is user ${newCreator.userId}.`,
    );
  }
}
