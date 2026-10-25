import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

export const INVALID_CREDENTIALS_MESSAGE = 'Identifiant ou mot de passe incorrect.';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);
    // One message for an unknown identifier and a wrong password: telling
    // them apart would let anyone test which emails and establishment IDs
    // hold an account (same convention as findIdentifier).
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    return user;
  }
}
