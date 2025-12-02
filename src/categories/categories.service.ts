import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './categories.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { User } from '../users/users.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto, user: User) {
    const newCategory = this.categoriesRepository.create({
      ...createCategoryDto,
      user: user, // Link category to the specific user
    });
    return await this.categoriesRepository.save(newCategory);
  }

  async findAll(user: User) {
    return await this.categoriesRepository.find({
      where: { user: { id: user.id } },
    });
  }
}
