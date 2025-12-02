import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Category } from './category.entity';
import { Routine } from './routines.entity';

@Entity('routine_lists')
export class RoutineList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, (category) => category.routineLists, {
    nullable: true,
    eager: false,
  })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ type: 'varchar' })
  title: string; // Örn: "Spor Yap Listesi"

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Routine, (routine) => routine.routineList)
  routines: Routine[];
}
