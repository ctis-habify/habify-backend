import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { RoutineList } from '../routine-lists/routine-lists.entity';

@Entity('routines')
export class Routine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'routine_list_id' })
  routineListId: number;

  @Column({ name: 'frequency_type' })
  frequencyType: string; // 'daily' | 'weekly'

  @Column({ type: 'time', default: '00:00:00', name: 'start_time' })
  startTime: string;

  @Column({ type: 'time', default: '23:59:59', name: 'end_time' })
  endTime: string;

  @Column({ default: false, name: 'is_ai_verified' })
  isAiVerified: boolean;

  @Column({ name: 'routine_name' })
  routineName: string;

  @Column({ default: 0 })
  streak: number;

  @Column({ name: 'missed_count', default: 0 })
  missedCount: number;

  @Column({ name: 'last_completed_date', type: 'date', nullable: true })
  lastCompletedDate: string;

  @Column({ type: 'date', name: 'start_date' })
  startDate: string;

  @Column({ type: 'time', nullable: true, name: 'reminder_time' })
  reminderTime: string;

  @Column({ default: true })
  active: boolean;

  @ManyToOne(() => RoutineList, (list) => list.routines)
  @JoinColumn({ name: 'routine_list_id' })
  routineList: RoutineList;
}
