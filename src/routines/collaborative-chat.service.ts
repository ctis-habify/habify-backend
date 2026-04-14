import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaborativeChatMessage } from './collaborative-chat-message.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import {
  PREDEFINED_CHAT_MESSAGES_CATEGORIZED,
  type PredefinedChatMessageItem,
} from './predefined-chat-messages';

@Injectable()
export class CollaborativeChatService {
  constructor(
    @InjectRepository(CollaborativeChatMessage)
    private readonly chatRepo: Repository<CollaborativeChatMessage>,
    @InjectRepository(CollaborativeRoutine)
    private readonly routineRepo: Repository<CollaborativeRoutine>,
  ) {}

  async getMessages(routineId: string): Promise<CollaborativeChatMessage[]> {
    return this.chatRepo.find({
      where: { routineId },
      order: { sentAt: 'ASC' },
      relations: ['user'],
    });
  }

  async sendMessage(
    routineId: string,
    userId: string,
    message: string,
  ): Promise<CollaborativeChatMessage> {
    const normalizedMessage = (message || '').trim();
    if (!normalizedMessage) {
      throw new BadRequestException('Message is required');
    }
    if (normalizedMessage.length > 160) {
      throw new BadRequestException('Message is too long');
    }
    const routine = await this.routineRepo.findOne({ where: { id: routineId } });
    if (!routine) throw new NotFoundException('Routine not found');
    const chat = this.chatRepo.create({ routineId, userId, message: normalizedMessage });
    return this.chatRepo.save(chat);
  }

  async sendSystemMessage(
    routineId: string,
    actorUserId: string,
    message: string,
  ): Promise<CollaborativeChatMessage> {
    const routine = await this.routineRepo.findOne({ where: { id: routineId } });
    if (!routine) throw new NotFoundException('Routine not found');
    const chat = this.chatRepo.create({
      routineId,
      userId: actorUserId,
      message: `[SYSTEM] ${message}`,
    });
    return this.chatRepo.save(chat);
  }

  getPredefinedMessages(): PredefinedChatMessageItem[] {
    return PREDEFINED_CHAT_MESSAGES_CATEGORIZED;
  }
}
