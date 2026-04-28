import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

import type { CollaborativeRoutine } from './collaborative-routines.entity';
import { User } from '../users/users.entity';

@Entity('routine_members')
export class CollaborativeRoutineMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'routine_id' })
  collaborativeRoutineId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ default: 0 })
  streak: number;

  @Column({ name: 'missed_count', default: 0 })
  missedCount: number;

  @Column({ name: 'last_completed_date', type: 'date', nullable: true })
  lastCompletedDate: string;

  @Column({ default: 'member' })
  role: string; // 'creator' | 'member'

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @ManyToOne('CollaborativeRoutine', 'members', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routine_id' })
  routine: CollaborativeRoutine;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
