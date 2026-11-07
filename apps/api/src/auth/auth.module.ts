import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { TokenVerifierService } from './token-verifier.service.js';
import { UsersService } from './users.service.js';

@Global()
@Module({
  imports: [AuditModule],
  providers: [TokenVerifierService, UsersService],
  exports: [TokenVerifierService, UsersService],
})
export class AuthModule {}
