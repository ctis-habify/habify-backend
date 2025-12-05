import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Category } from '../categories/categories.entity';

@Entity('routin_lists')
export class RoutineList {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // --- İLİŞKİLER (Düzeltilen Yerler) ---

  // 1. User İlişkisi (Tek Yönlü)
  // BURAYA DİKKAT: Parantez içinde sadece () => User var.
  // Yanında virgül veya (user) => user... YOK.
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  // 2. Category İlişkisi (Tek Yönlü)
  // Burada da sadece () => Category var.
  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'category_id' })
  categoryId: number;
}
