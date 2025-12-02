import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Routine } from '../routines/routines.entity';

@Entity('routine_logs')
export class RoutineLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', name: 'log_date' })
  logDate: Date;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'verification_image_url', nullable: true })
  verificationImageUrl: string;

  @ManyToOne(() => Routine)
  @JoinColumn({ name: 'routine_id' })
  routine: Routine;

  @Column({ name: 'user_id' })
  userId: string;
}
