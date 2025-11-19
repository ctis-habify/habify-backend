import { Injectable } from '@nestjs/common';

@Injectable()
export class RoutinesService {
  findAll() {
    return [
      { id: 1, name: 'Drink water', frequency: 'daily' },
      { id: 2, name: 'Walk 10k steps', frequency: 'daily' },
    ];
  }
}
