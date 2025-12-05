import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutineList } from './routine_lists.entity';
import { CreateRoutineListDto } from '../common/dto/routines/create-routine-list.dto';
import { Category } from '../categories/categories.entity';

@Injectable()
export class RoutineListsService {
  constructor(
    @InjectRepository(RoutineList)
    private routineListRepository: Repository<RoutineList>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async create(createDto: CreateRoutineListDto, userId: string) {
    const { title, categoryId } = createDto;

    const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const newList = this.routineListRepository.create({
      title: title,
      categoryId: categoryId,
      userId: userId,
    });

    return await this.routineListRepository.save(newList);
  }

  async findAll(userId: string) {
    return await this.routineListRepository.find({
      where: { userId: userId },
      relations: ['category'],
    });
  }
}
