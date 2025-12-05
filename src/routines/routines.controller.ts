import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { RoutinesService } from './routines.service';
import { AuthGuard } from '../auth/auth.guard';
import { GetRoutinesQueryDto } from './dto/get-routines-query';
import { GetRoutinesResponseDto } from './dto/routine-response.dto';

@ApiTags('Routines')
@ApiBearerAuth() // Swagger'da kilit ikonunu açar
@UseGuards(AuthGuard)
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Get()
  @ApiOperation({
    summary: 'Kullanıcının rutinlerini filtreli ve sıralı şekilde listele',
    description:
      'Filtreleme, sıralama ve sayfalama desteği ile rutinleri getirir. ' +
      'Önce /auth/login endpoint\'inden JWT token alınmalı ve "Authorize" butonuna tıklanarak token girilmelidir.',
  })
  @ApiOkResponse({
    description: 'Rutinler listesi döner. Her rutin, bağlı olduğu liste ve kategori bilgilerini içerir.',
    type: GetRoutinesResponseDto,
  })
  async findAll(@Req() req, @Query() query: GetRoutinesQueryDto) {
    // AuthGuard'dan gelen user objesindeki id
    // JWT payloadına göre 'sub' veya 'id' olabilir, kontrol et.
    const userId = req.user.id || req.user.sub;

    return this.routinesService.findAll(userId, query);
  }
}