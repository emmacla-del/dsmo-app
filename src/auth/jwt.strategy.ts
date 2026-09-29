import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from './jwt-secret';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
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

    // Tokens live 7 days with no revocation, so the payload's role/territory
    // may be stale and the account may since have been suspended, rejected or
    // deleted. Reload the account on every request; the token only proves who
    // is calling. A database outage surfaces as a 500 here (fail loud) rather
    // than falling back to the stale payload.
    if (typeof payload?.sub !== 'string' || !payload.sub) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, region: true, department: true, isActive: true, status: true },
    });
    // Same gate as login (AuthService.validateUser): only active, approved accounts.
    if (!user || !(user.isActive && user.status === 'ACTIVE')) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, role: user.role, region: user.region, department: user.department };
  }
}
