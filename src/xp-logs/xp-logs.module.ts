import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XpLogsService } from './xp-logs.service';
import { XpLogsController } from './xp-logs.controller';
import { XpLog } from './xp-logs.entity';
import { User } from '../users/users.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([XpLog, User])],
  controllers: [XpLogsController],
  providers: [XpLogsService],
  exports: [XpLogsService],
})
export class XpLogsModule {}
