import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('routines')
export class Routine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  routine_group_id: number;

  @Column()
  frequency_type: string;

  @Column({ nullable: true })
  frequency_detail: number;

  @Column({ type: 'time', default: '00:00:00' })
  start_time: string;

  @Column({ type: 'time', default: '23:59:59' })
  end_time: string;

  @Column({ default: false })
  is_ai_verified: boolean;
}
