import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Between } from 'typeorm';
import { Routine } from './routines.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { RoutineMember } from './routine-members.entity';
import { RoutineLog } from '../routine-logs/routine-logs.entity';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { User } from '../users/users.entity';
import { NotificationsService } from '../notifications/notifications.service';

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
    // Find active daily routines that were NOT completed yesterday
    // A routine is missed if its lastCompletedDate is not yesterday and it was active.
    // Note: We only care about daily routines for now or those whose cycle ended yesterday.

    const personalRoutines = await this.routineRepo.find({
      where: {
        active: true,
        startDate: LessThanOrEqual(yesterdayStr),
      },
    });

    for (const routine of personalRoutines) {
      if (routine.lastCompletedDate !== yesterdayStr) {
        // Double check if it was actually supposed to be done yesterday (daily check)
        // For simplicity, we assume daily routines for now.
        if (routine.frequencyType.toLowerCase() === 'daily') {
          this.logger.log(
            `User ${routine.userId} missed personal routine ${routine.id}. Deducting XP.`,
          );
          await this.xpLogsService.deductXP(routine.userId, 10, 'ROUTINE_MISSED');

          // Send Notification
          await this.notificationsService.createAndPush({
            userId: routine.userId,
            type: 'PENALTY',
            title: 'XP Penalty',
            body: `You lost 10 XP for missing your routine: ${routine.routineName}`,
            routineId: routine.id,
          });

          // Increment missed count if not already done by DB
          routine.missedCount += 1;
          routine.streak = 0; // Reset streak on miss
          await this.routineRepo.save(routine);
        }
      }
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
      let anyMemberMissed = false;

      for (const member of routine.members) {
        if (member.lastCompletedDate !== yesterdayStr) {
          if (routine.frequencyType.toLowerCase() === 'daily') {
            anyMemberMissed = true;
            this.logger.log(
              `User ${member.userId} missed collab routine ${routine.id}. Deducting XP.`,
            );
            await this.xpLogsService.deductXP(member.userId, 10, 'COLLAB_ROUTINE_MISSED');

            // Send Notification
            await this.notificationsService.createAndPush({
              userId: member.userId,
              type: 'PENALTY',
              title: 'Group XP Penalty',
              body: `You lost 10 XP for missing your part in the group: ${routine.routineName}`,
              collaborativeRoutineId: routine.id,
            });

            member.missedCount += 1;
            member.streak = 0;
            await this.memberRepo.save(member);
          }
        }
      }

      if (anyMemberMissed) {
        // Group lost a life
        routine.lives = Math.max(0, routine.lives - 1);
        this.logger.log(`Collab routine ${routine.id} lost a life. Remaining: ${routine.lives}`);

        if (routine.lives === 0) {
          this.logger.log(`Collab routine ${routine.id} is DEFEATED. Penalizing all members.`);
          for (const member of routine.members) {
            await this.xpLogsService.deductXP(member.userId, 20, 'COLLAB_GROUP_DEFEATED');

            // Send Defeat Notification
            await this.notificationsService.createAndPush({
              userId: member.userId,
              type: 'GROUP_DEFEAT',
              title: 'Group Defeated!',
              body: `The group routine ${routine.routineName} lost all lives. ALL members lost 20 XP.`,
              collaborativeRoutineId: routine.id,
            });
          }
          // Optional: Reset lives or mark as inactive?
          // For now, we'll just leave it at 0 lives.
        }

        await this.collabRoutineRepo.save(routine);
      }
    }
  }
}
