import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto, @Req() req) {
    return this.categoriesService.create(createCategoryDto, req.user);
  }

  @Get()
  findAll(@Req() req) {
    return this.categoriesService.findAll(req.user);
  }
}
