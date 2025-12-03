import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './categories.entity';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const newCategory = this.categoriesRepository.create(createCategoryDto);
    return await this.categoriesRepository.save(newCategory);
  }

  async findAll() {
    return await this.categoriesRepository.find();
  }
}
