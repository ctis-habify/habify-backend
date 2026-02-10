import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('due_reminders')
@Unique(['userId', 'routineId', 'scheduledFor'])
export class DueReminder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'routine_id' })
  routineId: string;

  @Column({ type: 'timestamptz', name: 'scheduled_for' })
  scheduledFor: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'sent_at' })
  sentAt: Date;
}
