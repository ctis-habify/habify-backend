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

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @ManyToOne(() => CollaborativeRoutine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collaborative_routine_id' })
  routine: CollaborativeRoutine;

  @Column({ name: 'user_id' })
  userId: string;

  @Column('text', { array: true, default: '{}' })
  approvals: string[];

  @Column('text', { array: true, default: '{}' })
  rejections: string[];

  @Column({ name: 'required_approvals', type: 'int', default: 1 })
  requiredApprovals: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
