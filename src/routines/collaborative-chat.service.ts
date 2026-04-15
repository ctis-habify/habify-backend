import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaborativeChatMessage } from './collaborative-chat-message.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { PREDEFINED_CHAT_MESSAGES } from './predefined-chat-messages';

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
    const normalizedMessage = message.trim();
    const hasValidPredefinedBody = PREDEFINED_CHAT_MESSAGES.some((predefinedMessage) => {
      if (normalizedMessage === predefinedMessage) {
        return true;
      }

      return normalizedMessage.startsWith(`${predefinedMessage} @`);
    });

    if (!hasValidPredefinedBody) {
      throw new ForbiddenException('Only predefined messages are allowed');
    }
    const routine = await this.routineRepo.findOne({ where: { id: routineId } });
    if (!routine) throw new NotFoundException('Routine not found');
    const chat = this.chatRepo.create({
      routineId,
      userId,
      message: normalizedMessage,
    });
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

  getPredefinedMessages(): string[] {
    return PREDEFINED_CHAT_MESSAGES;
  }
}
