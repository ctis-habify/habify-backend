export interface JwtPayload {
  id: string;
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}
