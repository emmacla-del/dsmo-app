import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from './jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
        ExtractJwt.fromUrlQueryParameter('access_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: any) {
    // Only access tokens are Bearer tokens. Special-purpose tokens signed with
    // the same secret (e.g. the 2FA challenge, purpose: '2fa_pending') must
    // not authenticate a request: the challenge is issued after the password
    // alone, so accepting it here bypassed the second factor. Any purpose
    // claim, whatever its value, is refused; access tokens never set one.
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'purpose')) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, email: payload.email, role: payload.role, region: payload.region, department: payload.department };
  }
}
