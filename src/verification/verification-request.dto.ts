import { IsUUID } from 'class-validator';

export class VerificationRequestDto {
  @IsUUID()
  id: string;
}
