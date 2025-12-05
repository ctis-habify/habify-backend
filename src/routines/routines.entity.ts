import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { RoutineList } from './routine-list.entity';

@Entity({ name: 'routines' })
export class Routine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => RoutineList, (routineList) => routineList.routines)
  @JoinColumn({ name: 'routine_list_id' })
  routineList: RoutineList;

  @ManyToOne(() => User, (user) => user.routines)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => RoutineList, { nullable: true })
  @JoinColumn({ name: 'routine_group_id' })
  routineGroup: RoutineList;

  @Column({ name: 'routine_group_id', nullable: true })
  routineGroupId: string | null;

  @Column({ name: 'frequency_type' })
  frequencyType: string; // "Daily" | "Weekly"

  @Column({ name: 'frequency_detail', type: 'int', nullable: true })
  frequencyDetail: number | null;

  @Column({ name: 'start_time', type: 'time', default: '00:00:00' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time', default: '23:59:59' })
  endTime: string;

  @Column({ name: 'is_ai_verified', type: 'boolean', default: false })
  isAiVerified: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

}
