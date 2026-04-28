import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalRoutineLogsService } from './routine-logs.service';
import { PersonalRoutineLogsController } from './routine-logs.controller';
import { PersonalRoutineLog } from './routine-logs.entity';
import { PersonalRoutine } from '../routines/routines.entity';
import { AuthModule } from 'src/auth/auth.module';
import { XpLogsModule } from '../xp-logs/xp-logs.module';
import { StorageModule } from 'src/storage/storage.module';
import { AiModule } from 'src/ai/ai.module';
import { UsersModule } from 'src/users/users.module';
import { RoutinesModule } from '../routines/routines.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([PersonalRoutineLog, PersonalRoutine]),
    XpLogsModule,
    StorageModule,
    AiModule,
    UsersModule,
    NotificationsModule,
    forwardRef(() => RoutinesModule),
  ],
  controllers: [PersonalRoutineLogsController],
  providers: [PersonalRoutineLogsService],
  exports: [PersonalRoutineLogsService],
})
export class PersonalRoutineLogsModule {}
