import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum Gender {
  FEMALE = 'female',
  MALE = 'male',
  OTHER = 'other',
  NA = 'na',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
    default: Gender.NA,
  })
  gender: Gender;

  @Column({ type: 'date', name: 'birthDate', nullable: true })
  birthDate: Date;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'total_xp', type: 'int', default: 0 })
  totalXp: number;

  @Column({ name: 'fcm_token', nullable: true })
  fcmToken: string;

  @Column({ name: 'current_streak', type: 'int', default: 0 })
  currentStreak: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({
    name: 'last_login_at',
    type: 'timestamp',
    nullable: true,
  })
  lastLoginAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
