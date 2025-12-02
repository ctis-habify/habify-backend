import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { RoutinesService } from './routines.service';
import { AuthGuard } from '../auth/auth.guard';
import { GetRoutinesQueryDto } from './dto/get-routines-query';

@ApiTags('Routines')
@ApiBearerAuth() // Swagger'da kilit ikonunu açar
@UseGuards(AuthGuard)
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Get()
  @ApiOperation({ summary: 'Kullanıcının rutin listelerini filtreli getir' })
  @ApiOkResponse({ description: 'Rutin listeleri ve içindeki rutinler döner.' })
  async findAll(@Req() req, @Query() query: GetRoutinesQueryDto) {
    // AuthGuard'dan gelen user objesindeki id
    // JWT payloadına göre 'sub' veya 'id' olabilir, kontrol et.
    const userId = req.user.id || req.user.sub; 
    
    return this.routinesService.findAllForUser(userId, query);
  }
}