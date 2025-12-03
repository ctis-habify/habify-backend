import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateRoutineListDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsNumber()
  categoryId: number;
}
