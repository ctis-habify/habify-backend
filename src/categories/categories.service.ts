import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './categories.entity';
import { CreateCategoryDto } from '../common/dto/categories/create-category.dto';
import { RoutineList } from 'src/routine-lists/routine-lists.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(RoutineList)
    private readonly routineListRepository: Repository<RoutineList>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const newCategory = this.categoriesRepository.create(createCategoryDto);
    return await this.categoriesRepository.save(newCategory);
  }

  async findAll(): Promise<Category[]> {
    return await this.categoriesRepository.find({
      order: { id: 'ASC' },
    });
  }

  async remove(id: number): Promise<{ message: string }> {
    // Check if category exists
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Check if it's used in any RoutineList
    const listCount = await this.routineListRepository.count({
      where: { categoryId: id },
    });

    if (listCount > 0) {
      throw new ConflictException(
        'Cannot delete category: It is currently associated with one or more routine lists.',
      );
    }

    await this.categoriesRepository.delete(id);
    return { message: 'Category deleted successfully' };
  }
}
