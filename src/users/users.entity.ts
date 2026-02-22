import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum Gender {
  female = 'female',
  male = 'male',
  other = 'other',
  na = 'na',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  username: string | null;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
    default: Gender.na,
  })
  gender: Gender;

  @Column({ type: 'date', name: 'birthDate', nullable: true })
  birthDate: Date | null;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'total_xp', type: 'int', default: 0 })
  totalXp: number;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'fcm_token', nullable: true })
  fcmToken: string;

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
