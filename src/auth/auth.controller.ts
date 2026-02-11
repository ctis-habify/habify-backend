import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from '../common/dto/auth/register.dto';
import { LoginDto } from '../common/dto/auth/login.dto';
import { User } from '../users/users.entity';
import { ApiTags, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('auth') // groups auth endpoints in Swagger
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiCreatedResponse({ description: 'User created and JWT returned.' })
  register(@Body() dto: RegisterDto): Promise<{ user: Partial<User>; accessToken: string }> {
    // handles the signup logic in the service
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOkResponse({ description: 'Login successful, JWT returned.' })
  login(@Body() dto: LoginDto): Promise<{ user: Partial<User>; accessToken: string }> {
    // passes the login data to the service and returns the result
    return this.authService.login(dto.email, dto.password);
  }
}
