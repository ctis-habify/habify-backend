import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorLogEntry {
  timestamp: string;
  errorCode: number;
  path: string;
  method: string;
  userId?: string | number;
  message: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.message : 'Internal server error';

    const user = (request as Request & { user?: { sub?: string | number; id?: string | number } })[
      'user'
    ];

    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      errorCode: status,
      path: request.url,
      method: request.method,
      userId: user?.sub ?? user?.id,
      message,
    };

    if (status >= 500) {
      // Major errors: full context with stack trace for debugging
      this.logger.error(
        `[MAJOR] ${JSON.stringify(entry)}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      // Minor errors: lightweight record for analytics, no disruption to user flow
      this.logger.warn(`[MINOR] ${JSON.stringify(entry)}`);
    }

    const responseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    response
      .status(status)
      .json(
        typeof responseBody === 'object' && responseBody !== null
          ? { ...(responseBody as object), timestamp: entry.timestamp }
          : responseBody,
      );
  }
}
