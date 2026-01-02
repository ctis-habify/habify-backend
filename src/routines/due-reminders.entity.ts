import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('due_reminders')
@Unique(['user_id', 'routine_id', 'scheduled_for'])
export class DueReminder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  routine_id: string;

  @Column({ type: 'timestamptz', name: 'scheduled_for' })
  scheduled_for: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'sent_at' })
  sent_at: Date;
}
