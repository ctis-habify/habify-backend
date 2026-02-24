import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';

export enum RoutineInvitationStatus {
  pending = 'pending',
  accepted = 'accepted',
  declined = 'declined',
}

@Entity('routine_invitations')
export class RoutineInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'routine_id' })
  routineId: string;

  @ManyToOne(() => CollaborativeRoutine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routine_id' })
  routine: CollaborativeRoutine;

  @Column({ name: 'from_user_id' })
  fromUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_user_id' })
  fromUser: User;

  @Column({ name: 'to_user_id' })
  toUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_user_id' })
  toUser: User;

  @Column({
    type: 'enum',
    enum: RoutineInvitationStatus,
    default: RoutineInvitationStatus.pending,
  })
  status: RoutineInvitationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
