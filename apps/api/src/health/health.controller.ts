import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Usado pelo health check do Render: responde 503 se o banco não responder.
  @Get()
  @ApiOperation({ summary: 'Verifica se a API e o banco estão no ar' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'erro', banco: 'indisponível' });
    }
    return { status: 'ok', banco: 'ok' };
  }
}
