import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './categories.entity';
import { CreateCategoryDto } from '../common/dto/categories/create-category.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('categories')
@ApiBearerAuth('access-token')
@Controller('categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  create(@Body() createCategoryDto: CreateCategoryDto): Promise<Category> {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  findAll(): Promise<Category[]> {
    return this.categoriesService.findAll();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category by ID' })
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.categoriesService.remove(+id);
  }
}
