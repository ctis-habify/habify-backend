import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonalRoutineList } from './routine-lists.entity';
import { CreatePersonalRoutineListDto } from '../common/dto/routines/create-routine-list.dto';
import { Category } from '../categories/categories.entity';
import { UpdatePersonalRoutineListDto } from '../common/dto/routines/update-routine-list.dto';
import { PersonalRoutine } from 'src/routines/routines.entity';

@Injectable()
export class PersonalRoutineListsService {
  constructor(
    @InjectRepository(PersonalRoutineList)
    private readonly routineListRepository: Repository<PersonalRoutineList>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(PersonalRoutine)
    private readonly routineRepository: Repository<PersonalRoutine>,
  ) {}

  async create(createDto: CreatePersonalRoutineListDto, userId: string): Promise<PersonalRoutineList> {
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

  async findAll(userId: string): Promise<PersonalRoutineList[]> {
    return await this.routineListRepository.find({
      where: { userId: userId },
      relations: ['category'],
    });
  }

  async update(id: number, updateDto: UpdatePersonalRoutineListDto, userId: string): Promise<PersonalRoutineList> {
    const list = await this.routineListRepository.findOne({
      where: { id, userId },
    });
    if (!list) {
      throw new NotFoundException('PersonalRoutine list not found');
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

  async remove(id: number, userId: string): Promise<{ message: string }> {
    const list = await this.routineListRepository.findOne({
      where: { id, userId },
    });
    if (!list) {
      throw new NotFoundException('PersonalRoutine list not found');
    }

    // Check for associated routines
    const routinesCount = await this.routineRepository.count({
      where: { routineListId: id },
    });

    if (routinesCount > 0) {
      throw new ConflictException('Cannot delete routine list: It contains one or more routines.');
    }

    await this.routineListRepository.delete(id);
    return { message: 'PersonalRoutine list deleted successfully' };
  }
}
