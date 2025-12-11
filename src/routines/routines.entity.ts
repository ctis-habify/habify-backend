import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { RoutineList } from '../routine_lists/routine_lists.entity';

@Entity('routines')
export class Routine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  routine_name: string;

  @Column()
  user_id: string;

  @Column({ name: 'routine_list_id' })
  routineListId: number;

  @Column()
  frequency_type: string; // 'daily' | 'weekly'

  @Column({ nullable: true })
  frequency_detail: number; // Haftalık ise: 0=Mon,1=Tue...

  @Column({ type: 'time', default: '00:00:00' })
  start_time: string;

  @Column({ type: 'time', default: '23:59:59' })
  end_time: string;

  @Column({ default: false })
  is_ai_verified: boolean;

  @Column({ type: 'date' })
  start_date: string;

  @ManyToOne(() => RoutineList, list => list.routines)
  @JoinColumn({ name: 'routine_list_id' })
  routine_list: RoutineList;
}
