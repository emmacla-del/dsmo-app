import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @Post('register')
  async register(@Body() body: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    region?: string;
    department?: string;
  }) {
    return this.authService.register(
      body.email, body.password, body.firstName, body.lastName,
      body.role, body.region, body.department,
    );
  }
}
