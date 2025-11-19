import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  getHealth() {
    return { status: 'ok', service: 'auth' };
  }
}
