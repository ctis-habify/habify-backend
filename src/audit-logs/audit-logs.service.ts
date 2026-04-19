import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuditLog, AuditLogType } from './audit-log.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Records an audit log entry.
   */
  async log(
    action: string,
    type: AuditLogType = AuditLogType.operational,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const entry = this.auditLogRepository.create({
        action,
        type,
        userId,
        metadata,
      });
      await this.auditLogRepository.save(entry);
    } catch (error) {
      this.logger.error(
        `Failed to save audit log: ${action}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

  }

  /**
   * Deletes logs older than the configured retention period.
   */
  async cleanup(): Promise<number> {
    const retentionDays = parseInt(
      this.configService.get<string>('AUDIT_LOG_RETENTION_DAYS') || '90',
      10,
    );
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.log(`Starting audit log cleanup. Cutoff date: ${cutoffDate.toISOString()}`);

    const result = await this.auditLogRepository.delete({
      createdAt: LessThan(cutoffDate),
    });

    const deletedCount = result.affected || 0;
    this.logger.log(`Audit log cleanup completed. Deleted ${deletedCount} entries.`);
    
    return deletedCount;
  }

  /**
   * For administrative debugging.
   */
  async findAll(): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
