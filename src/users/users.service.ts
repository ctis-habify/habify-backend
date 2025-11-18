import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  findAll() {
    return [
      { id: 1, name: 'Test User 1' },
      { id: 2, name: 'Test User 2' },
    ];
  }
}
