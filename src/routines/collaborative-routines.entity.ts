import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Category } from '../categories/categories.entity';
import { CollaborativeRoutineMember } from './routine-members.entity';
import { Gender } from '../users/users.entity';

@Entity('collaborative_routines')
export class CollaborativeRoutine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'routine_name' })
  routineName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'frequency_type' })
  frequencyType: string;

  @Column({ type: 'time', default: '00:00:00', name: 'start_time' })
  startTime: string;

  @Column({ type: 'time', default: '23:59:59', name: 'end_time' })
  endTime: string;

  @Column({ type: 'date', name: 'start_date' })
  startDate: string;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate: string | null;

  @Column({ name: 'category_id' })
  categoryId: number;

  @Column({ name: 'collaborative_key', unique: true })
  collaborativeKey: string;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @Column({ type: 'int', default: 0 })
  lives: number;

  @Column({ type: 'boolean', default: true, name: 'is_public' })
  isPublic: boolean;

  @Column({ type: 'text', nullable: true, name: 'reward_condition' })
  rewardCondition: string;

  @Column({ type: 'int', nullable: true, name: 'age_requirement' })
  ageRequirement: number;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
    name: 'gender_requirement',
  })
  genderRequirement: Gender;

  @Column({ type: 'int', default: 0, name: 'xp_requirement' })
  xpRequirement: number;

  @Column({ type: 'int', default: 10, name: 'completion_xp' })
  completionXp: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToMany(() => CollaborativeRoutineMember, (member) => member.routine)
  members: CollaborativeRoutineMember[];
}
