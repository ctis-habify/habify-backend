import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev_secret_jwtkey_hbfy',
    });
  }

  async validate(payload) {
    // payload = { id, email, ... } token içine ne koyduysan
    if (!payload) throw new UnauthorizedException();
    return payload; // request.user olarak döner
  }
}
