import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Routine } from '../routines/routines.entity';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'routine_id', nullable: true })
  routineId: string | null;

  @Column({ length: 50 })
  type: string; // 'task_reminder' | 'deadline_warning' | 'general'

  @Column()
  title: string;

  @Column()
  body: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'push_sent', default: false })
  pushSent: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Routine, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'routine_id' })
  routine: Routine;

  @Column({ type: 'uuid', name: 'collaborative_routine_id', nullable: true })
  collaborativeRoutineId: string | null;

  @ManyToOne(() => CollaborativeRoutine, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'collaborative_routine_id' })
  collaborativeRoutine: CollaborativeRoutine;
}
