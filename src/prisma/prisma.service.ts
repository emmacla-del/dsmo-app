import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Prisma's own default connection_limit, when DATABASE_URL doesn't specify
// one, is `num_physical_cpus * 2 + 1` — on a small Render instance (1 vCPU)
// that's as few as 3 pooled connections shared by every request the whole
// process handles. Under real concurrent load (many companies submitting
// near the same campaign deadline, plus a superadmin bulk export holding a
// connection open for a batched query loop) that's little enough to queue
// requests behind each other and start timing them out well before the
// database itself is under any real strain. Raised to a value generous
// enough for that concurrency without overwhelming Supabase's own pooler on
// the other end — only applied when the URL doesn't already set one, so an
// operator-tuned DATABASE_URL (e.g. one already routed through PgBouncer
// with its own limit) is never silently overridden.
function withPoolDefaults(url: string | undefined): string | undefined {
  if (!url) return url;
  if (/[?&]connection_limit=/.test(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=20&pool_timeout=20`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: { url: withPoolDefaults(process.env.DATABASE_URL) },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
