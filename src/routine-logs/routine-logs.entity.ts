import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { PersonalRoutine } from '../routines/routines.entity';

@Entity('personal_routine_logs')
export class PersonalRoutineLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', name: 'log_date' })
  logDate: Date;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'verification_image_url', nullable: true })
  verificationImageUrl: string;

  @ManyToOne(() => PersonalRoutine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routine_id' })
  routine: PersonalRoutine;

  @Column({ name: 'user_id' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
