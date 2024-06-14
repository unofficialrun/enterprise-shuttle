import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppShuttleCommand } from './app.command';
import { KyselyModule } from 'nestjs-kysely';
import { CamelCasePlugin, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import Cursor from 'pg-cursor';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    HealthModule,
    ConfigModule.forRoot(),
    KyselyModule.forRoot({
      dialect: new PostgresDialect({
        pool: new Pool({
          max: 10,
          connectionString: process.env.POSTGRES_URL,
        }),
        cursor: Cursor,
      }),
      plugins: [new CamelCasePlugin()],
    }),
  ],
  providers: [AppShuttleCommand],
  exports: [AppShuttleCommand]
})
export class AppModule { }
