import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Routine } from 'src/routines/routines.entity';

export type VerificationStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

@Entity('verifications')
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Routine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routine_id' })
  routine: Routine;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'verification_image_url' })
  verificationImageUrl: string;

  @Column({ type: 'float', nullable: true })
  score?: number;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'fail_reason', type: 'text', nullable: true })
  failReason?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: VerificationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
