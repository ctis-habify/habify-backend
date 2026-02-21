import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CollaborativeRoutine } from './collaborative-routines.entity';

@Entity('collaborative_routine_logs')
export class CollaborativeRoutineLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', name: 'log_date' })
  logDate: Date;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'verification_image_url', nullable: true })
  verificationImageUrl: string;

  @ManyToOne(() => CollaborativeRoutine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collaborative_routine_id' })
  routine: CollaborativeRoutine;

  @Column({ name: 'user_id' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
