import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutineList } from './routine-list.entity';
import { GetRoutinesQueryDto } from './dto/get-routines-query';

@Injectable()
export class RoutinesService {
  constructor(
    @InjectRepository(RoutineList)
    private readonly routineListRepo: Repository<RoutineList>,
    // Diğer repolara şu an bu fonksiyonda ihtiyacımız yoksa inject etmeyebiliriz
  ) {}

  async findAllForUser(userId: number, query: GetRoutinesQueryDto) { // userId tipine dikkat (number/string)
    const {
      listId,
      categoryId,
      frequencyType,
      search,
      sortBy,
      sortOrder = 'DESC',
      page = 1,
      limit = 20,
    } = query;

    const qb = this.routineListRepo.createQueryBuilder('list')
      .leftJoinAndSelect('list.category', 'category')
      .leftJoinAndSelect('list.routines', 'routine')
      .where('list.userId = :userId', { userId });

    // --- Filtreler ---

    if (listId) {
      qb.andWhere('list.id = :listId', { listId });
    }

    if (categoryId) {
      qb.andWhere('list.categoryId = :categoryId', { categoryId });
    }

    if (frequencyType) {
      // Sadece bu frekansta rutini olan listeleri getirir
      qb.andWhere('routine.frequencyType = :frequencyType', { frequencyType });
    }

    if (search) {
      // Hem liste başlığında hem de rutin başlığında arama yapalım
      qb.andWhere(
        '(LOWER(list.title) LIKE :search OR LOWER(routine.title) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    // --- Sıralama ---
    // Not: İlişkili tablolarda (OneToMany) sıralama yaparken dikkatli olunmalıdır.
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    if (sortBy === 'startTime') {
      qb.orderBy('routine.startTime', orderDirection);
    } else if (sortBy === 'title') {
      qb.orderBy('list.title', orderDirection);
    } else {
      // Default: List creation date
      qb.orderBy('list.createdAt', orderDirection);
    }

    // --- Pagination ---
    qb.skip((page - 1) * limit).take(limit);

    // Veriyi çek
    const [lists, total] = await qb.getManyAndCount();

    // --- Response Formatlama ---
    const data = lists.map((list) => ({
      id: list.id,
      title: list.title,
      category: list.category ? { id: list.category.id, name: list.category.name } : null,
      routines: (list.routines ?? []).map((r) => ({
        id: r.id,
        frequencyType: r.frequencyType,
        startTime: r.startTime,
        endTime: r.endTime,
        isAiVerified: r.isAiVerified,
        // Frekansa göre filtrelendiyse sadece o frekanstakiler döner (TypeORM mantığı gereği)
      })),
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