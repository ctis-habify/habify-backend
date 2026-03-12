import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Between, Repository } from 'typeorm';
import axios from 'axios';

import { Notification } from './notifications.entity';
import { Routine } from '../routines/routines.entity';
import { RoutineLog } from '../routine-logs/routine-logs.entity';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';
import { RoutineMember } from '../routines/routine-members.entity';
import { CollaborativeRoutineLog } from '../routines/collaborative-routine-logs.entity';
import { User } from '../users/users.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private scanRunning = false;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(Routine)
    private readonly routineRepo: Repository<Routine>,

    @InjectRepository(RoutineLog)
    private readonly logRepo: Repository<RoutineLog>,

    @InjectRepository(CollaborativeRoutine)
    private readonly collabRoutineRepo: Repository<CollaborativeRoutine>,

    @InjectRepository(RoutineMember)
    private readonly memberRepo: Repository<RoutineMember>,

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
        await this.processRoutineReminder(routine, now);
      }

      const collabRoutines = await this.collabRoutineRepo.find({
        relations: ['members'],
      });

      for (const collab of collabRoutines) {
        for (const member of collab.members) {
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

  private async processRoutineReminder(routine: Routine, now: Date): Promise<void> {
    const deadline = this.calculateDeadline(routine, now);
    if (!deadline || now >= deadline) return;

    const isCompleted = await this.isRoutineCompleted(routine, now);
    if (isCompleted) return;

    const remainingMs = deadline.getTime() - now.getTime();
    const remainingMin = Math.ceil(remainingMs / (60 * 1000));
    const timeLabel = this.formatTimeRemaining(remainingMin);
    const body = `"${routine.routineName}" is still unfinished – ${timeLabel} remaining.`;

    const rows: Notification[] = await this.notificationRepo.query(
      `INSERT INTO notifications (user_id, routine_id, type, title, body, push_sent, is_read)
       SELECT $1, $2, $3, $4, $5, false, false
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE user_id = $1 AND routine_id = $2 AND type = $3
           AND created_at > NOW() - INTERVAL '29 minutes'
       )
       RETURNING *`,
      [routine.userId, routine.id, 'task_reminder', 'Routine Reminder', body],
    );

    if (rows.length > 0) {
      await this.sendPushNotification(routine.userId, rows[0]);
    }
  }

  private async processCollabRoutineReminder(
    routine: CollaborativeRoutine,
    member: RoutineMember,
    now: Date,
  ): Promise<void> {
    const deadline = this.calculateCollabDeadline(routine, now);
    if (!deadline || now >= deadline) return;

    const isCompleted = await this.isCollabRoutineCompleted(routine, member.userId, now);
    if (isCompleted) return;

    const remainingMs = deadline.getTime() - now.getTime();
    const remainingMin = Math.ceil(remainingMs / (60 * 1000));
    const timeLabel = this.formatTimeRemaining(remainingMin);
    const body = `[Group] "${routine.routineName}" is still unfinished – ${timeLabel} remaining.`;

    const rows: Notification[] = await this.notificationRepo.query(
      `INSERT INTO notifications (user_id, collaborative_routine_id, type, title, body, push_sent, is_read)
       SELECT $1, $2, $3, $4, $5, false, false
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE user_id = $1 AND collaborative_routine_id = $2 AND type = $3
           AND created_at > NOW() - INTERVAL '29 minutes'
       )
       RETURNING *`,
      [member.userId, routine.id, 'task_reminder', 'Group Routine Reminder', body],
    );

    if (rows.length > 0) {
      await this.sendPushNotification(member.userId, rows[0]);
    }
  }

  private calculateCollabDeadline(routine: CollaborativeRoutine, now: Date): Date | null {
    const freq = routine.frequencyType?.toLowerCase();

    if (freq === 'daily') {
      const [h, m, s] = (routine.endTime || '23:59:59').split(':').map(Number);
      const deadline = new Date(now);
      deadline.setHours(h ?? 23, m ?? 59, s ?? 59, 0);
      return deadline;
    }

    if (freq === 'weekly') {
      const [sy, sm, sd] = routine.startDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      const diffTime = now.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return null;

      const currentCycleIndex = Math.floor(diffDays / 7);
      const daysToAdd = currentCycleIndex * 7 + 6;
      const deadline = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      deadline.setHours(23, 59, 59, 999);
      return deadline;
    }

    return null;
  }

  private async isCollabRoutineCompleted(
    routine: CollaborativeRoutine,
    userId: string,
    now: Date,
  ): Promise<boolean> {
    const freq = routine.frequencyType?.toLowerCase();

    if (freq === 'daily') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const log = await this.collabLogRepo.findOne({
        where: {
          userId,
          routine: { id: routine.id },
          logDate: Between(startOfDay, endOfDay),
          isVerified: true,
        },
        relations: ['routine'],
      });
      return !!log;
    }

    if (freq === 'weekly') {
      const [sy, sm, sd] = routine.startDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      const diffTime = now.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const currentCycleIndex = diffDays >= 0 ? Math.floor(diffDays / 7) : 0;

      const cycleStart = new Date(start.getTime() + currentCycleIndex * 7 * 24 * 60 * 60 * 1000);
      cycleStart.setHours(0, 0, 0, 0);
      const cycleEnd = new Date(cycleStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

      const log = await this.collabLogRepo.findOne({
        where: {
          userId,
          routine: { id: routine.id },
          logDate: Between(cycleStart, cycleEnd),
          isVerified: true,
        },
        relations: ['routine'],
      });
      return !!log;
    }

    return false;
  }

  private calculateDeadline(routine: Routine, now: Date): Date | null {
    const freq = routine.frequencyType?.toLowerCase();

    if (freq === 'daily') {
      const [h, m, s] = (routine.endTime || '23:59:59').split(':').map(Number);
      const deadline = new Date(now);
      deadline.setHours(h ?? 23, m ?? 59, s ?? 59, 0);
      return deadline;
    }

    if (freq === 'weekly') {
      const [sy, sm, sd] = routine.startDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      const diffTime = now.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return null;

      const currentCycleIndex = Math.floor(diffDays / 7);
      const daysToAdd = currentCycleIndex * 7 + 6;
      const deadline = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      deadline.setHours(23, 59, 59, 999);
      return deadline;
    }

    return null;
  }

  private async isRoutineCompleted(routine: Routine, now: Date): Promise<boolean> {
    const freq = routine.frequencyType?.toLowerCase();

    if (freq === 'daily') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const log = await this.logRepo.findOne({
        where: {
          userId: routine.userId,
          routine: { id: routine.id },
          logDate: Between(startOfDay, endOfDay),
          isVerified: true,
        },
        relations: ['routine'],
      });
      return !!log;
    }

    if (freq === 'weekly') {
      const [sy, sm, sd] = routine.startDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      const diffTime = now.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const currentCycleIndex = diffDays >= 0 ? Math.floor(diffDays / 7) : 0;

      const cycleStart = new Date(start.getTime() + currentCycleIndex * 7 * 24 * 60 * 60 * 1000);
      cycleStart.setHours(0, 0, 0, 0);
      const cycleEnd = new Date(cycleStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

      const log = await this.logRepo.findOne({
        where: {
          userId: routine.userId,
          routine: { id: routine.id },
          logDate: Between(cycleStart, cycleEnd),
          isVerified: true,
        },
        relations: ['routine'],
      });
      return !!log;
    }

    return false;
  }

  async createAndPush(opts: {
    userId: string;
    type: string;
    title: string;
    body: string;
    routineId?: string | null;
    collaborativeRoutineId?: string | null;
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
    await this.sendPushNotification(opts.userId, saved);
    return saved;
  }

  private async sendPushNotification(userId: string, notification: Notification): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.fcmToken) return;

    try {
      await axios.post('https://exp.host/--/api/v2/push/send', {
        to: user.fcmToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
          routineId: notification.routineId,
          type: notification.type,
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

  // ── REST API methods ──

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
}
