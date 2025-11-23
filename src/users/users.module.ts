import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm'; // For db
// import { User } from './users.entity'; // For db
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  // imports: [TypeOrmModule.forFeature([User])], // For db
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
