import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/users.entity';

export enum AuditLogType {
  security = 'SECURITY',
  operational = 'OPERATIONAL',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  action: string; // e.g., 'LOGIN', 'REGISTER', 'ROUTINE_CREATE'

  @Column({
    type: 'enum',
    enum: AuditLogType,
    default: AuditLogType.operational,
  })
  type: AuditLogType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>; // Extra info like IP, user agent, or record IDs

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
