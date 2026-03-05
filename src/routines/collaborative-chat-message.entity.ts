import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { User } from '../users/users.entity';

@Entity('collaborative_chat_messages')
export class CollaborativeChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'routine_id' })
  routineId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;

  @ManyToOne(() => CollaborativeRoutine, (routine) => routine.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routine_id' })
  routine: CollaborativeRoutine;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
