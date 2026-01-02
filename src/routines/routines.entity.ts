import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { RoutineList } from '../routine_lists/routine_lists.entity';

@Entity('routines')
export class Routine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  routine_list_id: number;

  @Column()
  frequency_type: string; // 'daily' | 'weekly'

  @Column({ type: 'time', default: '00:00:00' })
  start_time: string;

  @Column({ type: 'time', default: '23:59:59' })
  end_time: string;

  @Column({ default: false })
  is_ai_verified: boolean;

  @Column()
  routine_name: string;

  @Column({ default: 0 })
  streak: number;

  @Column({ name: 'missed_count', default: 0 })
  missed_count: number;

  @Column({ name: 'last_completed_date', type: 'date', nullable: true })
  last_completed_date: string;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'time', nullable: true, name: 'reminder_time' })
  reminder_time: string;

  @Column({ default: true })
  active: boolean;

  @ManyToOne(() => RoutineList, list => list.routines)
  @JoinColumn({ name: 'routine_list_id' })
  routine_list: RoutineList;
}
