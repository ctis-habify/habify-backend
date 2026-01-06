import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutineList } from './routine_lists.entity';
import { CreateRoutineListDto } from '../common/dto/routines/create-routine-list.dto';
import { Category } from '../categories/categories.entity';
import { UpdateRoutineListDto } from '../common/dto/routines/update-routine-list.dto';
import { Routine } from 'src/routines/routines.entity';

@Injectable()
export class RoutineListsService {
  constructor(
    @InjectRepository(RoutineList)
    private routineListRepository: Repository<RoutineList>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Routine)
    private routineRepository: Repository<Routine>,
  ) {}

  async create(createDto: CreateRoutineListDto, userId: string) {
    const { title, categoryId } = createDto;

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
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

  async update(id: number, updateDto: UpdateRoutineListDto, userId: string) {
    const list = await this.routineListRepository.findOne({
      where: { id, userId },
    });
    if (!list) {
      throw new NotFoundException('Routine list not found');
    }

    if (updateDto.title) {
      list.title = updateDto.title;
    }

    if (updateDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: updateDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
      list.categoryId = updateDto.categoryId;
    }

    return await this.routineListRepository.save(list);
  }

  async remove(id: number, userId: string) {
    const list = await this.routineListRepository.findOne({
      where: { id, userId },
    });
    if (!list) {
      throw new NotFoundException('Routine list not found');
    }

    // Check for associated routines
    const routinesCount = await this.routineRepository.count({
      where: { routine_list_id: id },
    });

    if (routinesCount > 0) {
      throw new ConflictException(
        'Cannot delete routine list: It contains one or more routines.',
      );
    }

    await this.routineListRepository.delete(id);
    return { message: 'Routine list deleted successfully' };
  }
}
