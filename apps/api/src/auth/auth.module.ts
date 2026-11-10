import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ReferralsModule } from '../referrals/referrals.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenVerifierService } from './token-verifier.service.js';
import { UsersService } from './users.service.js';

@Global()
@Module({
  imports: [AuditModule, ReferralsModule],
  controllers: [AuthController],
  providers: [TokenVerifierService, UsersService, AuthService],
  exports: [TokenVerifierService, UsersService],
})
export class AuthModule {}
