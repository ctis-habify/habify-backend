import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Between, Repository } from 'typeorm';
import axios from 'axios';

import { Notification } from './notifications.entity';
import { PersonalRoutine} from '../routines/routines.entity';
import { PersonalRoutineLog} from '../routine-logs/routine-logs.entity';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';
import { CollaborativeRoutineMember } from '../routines/routine-members.entity';
import { CollaborativeRoutineLog } from '../routines/collaborative-routine-logs.entity';
import { User } from '../users/users.entity';
import { SendPokeDto } from '../common/dto/pokes/send-poke.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private scanRunning = false;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(PersonalRoutine)
    private readonly routineRepo: Repository<PersonalRoutine>,

    @InjectRepository(PersonalRoutineLog)
    private readonly logRepo: Repository<PersonalRoutineLog>,

    @InjectRepository(CollaborativeRoutine)
    private readonly collabRoutineRepo: Repository<CollaborativeRoutine>,

    @InjectRepository(CollaborativeRoutineMember)
    private readonly memberRepo: Repository<CollaborativeRoutineMember>,

    @InjectRepository(CollaborativeRoutineLog)
    private readonly collabLogRepo: Repository<CollaborativeRoutineLog>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Cron('0 */30 * * * *')
  async scanAndSendReminders(): Promise<void> {
    if (this.scanRunning) {
      this.logger.warn('Reminder scan already in progress – skipping');
      return;
    }

    this.scanRunning = true;
    this.logger.log('Starting 30-minute reminder scan…');
    const now = new Date();

    try {
      const routines = await this.routineRepo.find({
        where: { active: true },
      });

      for (const routine of routines) {
        if (!this.hasRoutineStarted(routine, now)) continue;
        await this.processRoutineReminder(routine, now);
      }

      const collabRoutines = await this.collabRoutineRepo.find({
        relations: ['members'],
      });

      for (const collab of collabRoutines) {
        for (const member of collab.members) {
          if (!this.hasRoutineStarted(collab, now)) continue;
          await this.processCollabRoutineReminder(collab, member, now);
        }
      }

      this.logger.log(
        `Reminder scan complete – processed ${routines.length} personal + ${collabRoutines.length} collaborative routines`,
      );
    } catch (error) {
      this.logger.error('Reminder scan failed', error);
    } finally {
      this.scanRunning = false;
    }
  }

  private hasRoutineStarted(routine: PersonalRoutine | CollaborativeRoutine, now: Date): boolean {
    if (routine.startDate) {
      const todayStr = now.toISOString().split('T')[0];
      if (routine.startDate > todayStr) return false;
    }

    if (routine.startTime) {
      const [h, m, s] = routine.startTime.split(':').map(Number);
      const startDateTime = new Date(now);
      startDateTime.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
      if (now < startDateTime) return false;
    }
    
    return true;
  }

  private async processRoutineReminder(routine: PersonalRoutine, now: Date): Promise<void> {
    const deadline = this.getDeadline(routine, now);
    if (!deadline || now >= deadline) return;

    if (await this.isCompleted(routine, routine.userId, now)) return;

    const remainingMin = Math.ceil((deadline.getTime() - now.getTime()) / 60000);
    const body = `"${routine.routineName}" is still unfinished – ${this.formatTimeRemaining(remainingMin)} remaining.`;

    const rows: Notification[] = await this.notificationRepo.query(
      `INSERT INTO notifications (user_id, routine_id, type, title, body, push_sent, is_read)
       SELECT $1::uuid, $2::uuid, $3::varchar, $4, $5, false, false
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE user_id = $1::uuid AND routine_id = $2::uuid AND type = $3::varchar
           AND created_at > NOW() - INTERVAL '29 minutes'
       )
       RETURNING *`,
      [routine.userId, routine.id, 'task_reminder', 'Routine Reminder', body],
    );

    if (rows.length > 0) await this.sendPushNotification(routine.userId, rows[0]);
  }

  private async processCollabRoutineReminder(
    routine: CollaborativeRoutine,
    member: CollaborativeRoutineMember,
    now: Date,
  ): Promise<void> {
    const deadline = this.getDeadline(routine, now);
    if (!deadline || now >= deadline) return;

    if (await this.isCompleted(routine, member.userId, now)) return;

    const remainingMin = Math.ceil((deadline.getTime() - now.getTime()) / 60000);
    const body = `[Group] "${routine.routineName}" is still unfinished – ${this.formatTimeRemaining(remainingMin)} remaining.`;

    const rows: Notification[] = await this.notificationRepo.query(
      `INSERT INTO notifications (user_id, collaborative_routine_id, type, title, body, push_sent, is_read)
       SELECT $1::uuid, $2::uuid, $3::varchar, $4, $5, false, false
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE user_id = $1::uuid AND collaborative_routine_id = $2::uuid AND type = $3::varchar
           AND created_at > NOW() - INTERVAL '29 minutes'
       )
       RETURNING *`,
      [member.userId, routine.id, 'task_reminder', 'Group Routine Reminder', body],
    );

    if (rows.length > 0) await this.sendPushNotification(member.userId, rows[0]);
  }

  private getDeadline(routine: PersonalRoutine | CollaborativeRoutine, now: Date): Date | null {
    const freq = routine.frequencyType?.toLowerCase();
    if (freq === 'daily') {
      const [h, m, s] = (routine.endTime || '23:59:59').split(':').map(Number);
      const d = new Date(now);
      d.setHours(h ?? 23, m ?? 59, s ?? 59, 0);
      return d;
    }
    if (freq === 'weekly') {
      const [sy, sm, sd] = routine.startDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
      if (diffDays < 0) return null;
      const deadline = new Date(start.getTime() + (Math.floor(diffDays / 7) * 7 + 6) * 86400000);
      deadline.setHours(23, 59, 59, 999);
      return deadline;
    }
    return null;
  }

  private async isCompleted(
    routine: PersonalRoutine | CollaborativeRoutine,
    userId: string,
    now: Date,
  ): Promise<boolean> {
    const isCollab = 'members' in routine || !('userId' in routine);
    const repo = isCollab ? this.collabLogRepo : this.logRepo;
    const freq = routine.frequencyType?.toLowerCase();

    let start: Date, end: Date;
    if (freq === 'daily') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (freq === 'weekly') {
      const [sy, sm, sd] = routine.startDate.split('-').map(Number);
      const cycleStart = new Date(
        new Date(sy, sm - 1, sd, 0, 0, 0, 0).getTime() +
          Math.floor(
            Math.floor(
              (now.getTime() - new Date(sy, sm - 1, sd, 0, 0, 0, 0).getTime()) / 86400000,
            ) / 7,
          ) *
            7 *
            86400000,
      );
      start = cycleStart;
      start.setHours(0, 0, 0, 0);
      end = new Date(start.getTime() + 7 * 86400000 - 1);
    } else return false;

    const where: Record<string, unknown> = {
      userId,
      routine: { id: routine.id },
      logDate: Between(start, end),
      isVerified: true,
    };
    if (!isCollab) where.userId = (routine as PersonalRoutine).userId;

    const found = await (repo as Repository<PersonalRoutineLog | CollaborativeRoutineLog>).findOne({
      where,
    });
    return !!found;
  }

  async createAndPush(opts: {
    userId: string;
    type: string;
    title: string;
    body: string;
    routineId?: string | null;
    collaborativeRoutineId?: string | null;
    data?: Record<string, string | number | boolean | null>;
  }): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      routineId: opts.routineId ?? null,
      collaborativeRoutineId: opts.collaborativeRoutineId ?? null,
      isRead: false,
      pushSent: false,
    });
    const saved = await this.notificationRepo.save(notification);
    await this.sendPushNotification(opts.userId, saved, opts.data);
    return saved;
  }

  private async sendPushNotification(
    userId: string,
    notification: Notification,
    data?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.fcmToken) {
      this.logger.log(`Skipping push notification for user ${userId}: No fcmToken found`);
      return;
    }

    try {
      await axios.post('https://exp.host/--/api/v2/push/send', {
        to: user.fcmToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
          routineId: notification.routineId,
          collaborativeRoutineId: notification.collaborativeRoutineId,
          type: notification.type,
          ...data,
        },
      });

      notification.pushSent = true;
      await this.notificationRepo.save(notification);
    } catch (error) {
      this.logger.warn(`Push notification failed for user ${userId}: ${error}`);
    }
  }

  private formatTimeRemaining(minutes: number): string {
    if (minutes >= 1440) {
      const days = Math.ceil(minutes / 1440);
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  async sendPoke(fromUserId: string, dto: SendPokeDto): Promise<{ message: string }> {
    const { toUserId, collaborativeRoutineId } = dto;

    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot poke yourself');
    }

    // Verify target user exists
    const toUser = await this.userRepo.findOne({ where: { id: toUserId } });
    if (!toUser) {
      throw new NotFoundException('User not found');
    }

    // Verify the collaborative routine exists
    const routine = await this.collabRoutineRepo.findOne({
      where: { id: collaborativeRoutineId },
    });
    if (!routine) {
      throw new NotFoundException('Collaborative routine not found');
    }

    // Verify both users are members of the routine
    const senderMember = await this.memberRepo.findOne({
      where: { collaborativeRoutineId, userId: fromUserId },
    });
    if (!senderMember) {
      throw new BadRequestException('You are not a member of this routine');
    }

    const targetMember = await this.memberRepo.findOne({
      where: { collaborativeRoutineId, userId: toUserId },
    });
    if (!targetMember) {
      throw new BadRequestException('Target user is not a member of this routine');
    }

    const fromUser = await this.userRepo.findOne({ where: { id: fromUserId } });
    const senderName = fromUser?.name ?? 'Someone';

    await this.createAndPush({
      userId: toUserId,
      type: 'poke',
      title: 'Poke! 👈',
      body: `${senderName} poked you in "${routine.routineName}"!`,
      collaborativeRoutineId,
    });

    return { message: 'Poke sent' };
  }

  async getUserNotifications(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ data: Notification[]; total: number }> {
    const [data, total] = await this.notificationRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['routine', 'collaborativeRoutine'],
    });
    return { data, total };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationRepo.update({ id: notificationId, userId }, { isRead: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await this.notificationRepo.delete({ id: notificationId, userId });
  }

  async updatePushToken(userId: string, token: string): Promise<void> {
    await this.userRepo.update(userId, { fcmToken: token });
  }

  async removePushToken(userId: string): Promise<void> {
    await this.userRepo.update(userId, { fcmToken: '' });
  }

  async cleanup(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.notificationRepo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('created_at < :date', { date: thirtyDaysAgo })
      .execute();

    const deletedCount = result.affected ?? 0;
    this.logger.log(
      `Cleanup: Deleted ${deletedCount} notifications older than ${thirtyDaysAgo.toISOString()}`,
    );
    return deletedCount;
  }
}
