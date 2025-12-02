import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RoutineList } from './routine-list.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string; // Örn: "Fitness"

  @OneToMany(() => RoutineList, (list) => list.category)
  routineLists: RoutineList[];
}
