import { Controller, Get } from '@nestjs/common';
import { RoutinesService } from './routines.service';

@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Get()
  findAll() {
    return this.routinesService.findAll();
  }
}
