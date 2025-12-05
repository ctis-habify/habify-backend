import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Routine } from './routines.entity';
import { GetRoutinesQueryDto } from './dto/get-routines-query';

@Injectable()
export class RoutinesService {
  constructor(
    @InjectRepository(Routine)
    private readonly routineRepo: Repository<Routine>,
  ) {}

  async findAll(userId: string, query: GetRoutinesQueryDto) {
    const {
      listId,
      routineGroupId,
      categoryId,
      frequencyType,
      isAiVerified,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query;

    const qb = this.routineRepo
      .createQueryBuilder('routine')
      .leftJoinAndSelect('routine.routineList', 'routineList')
      .leftJoinAndSelect('routineList.category', 'category')
      .where('routine.userId = :userId', { userId });

    // --- Filtreler ---

    if (listId) {
      qb.andWhere('routineList.id = :listId', { listId });
    }

    if (routineGroupId) {
      qb.andWhere('routine.routineGroupId = :routineGroupId', {
        routineGroupId,
      });
    }

    if (categoryId) {
      qb.andWhere('routineList.categoryId = :categoryId', { categoryId });
    }

    if (frequencyType) {
      qb.andWhere('routine.frequencyType = :frequencyType', { frequencyType });
    }

    if (isAiVerified !== undefined) {
      qb.andWhere('routine.isAiVerified = :isAiVerified', { isAiVerified });
    }

    if (search) {
      qb.andWhere('LOWER(routineList.title) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }

    // --- Sıralama ---
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    switch (sortBy) {
      case 'startTime':
        qb.orderBy('routine.startTime', orderDirection);
        break;
      case 'endTime':
        qb.orderBy('routine.endTime', orderDirection);
        break;
      case 'frequencyType':
        qb.orderBy('routine.frequencyType', orderDirection);
        break;
      case 'createdAt':
      default:
        qb.orderBy('routine.createdAt', orderDirection);
        break;
    }

    // --- Pagination ---
    qb.skip((page - 1) * limit).take(limit);

    // Veriyi çek
    const [routines, total] = await qb.getManyAndCount();

    // --- Response Formatlama ---
    const data = routines.map((routine) => ({
      id: routine.id,
      userId: routine.userId,
      frequencyType: routine.frequencyType,
      frequencyDetail: routine.frequencyDetail,
      startTime: routine.startTime,
      endTime: routine.endTime,
      isAiVerified: routine.isAiVerified,
      routineGroupId: routine.routineGroupId,
      createdAt: routine.createdAt,
      routineList: routine.routineList
        ? {
            id: routine.routineList.id,
            title: routine.routineList.title,
            category: routine.routineList.category
              ? {
                  id: routine.routineList.category.id,
                  name: routine.routineList.category.name,
                }
              : null,
          }
        : null,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}