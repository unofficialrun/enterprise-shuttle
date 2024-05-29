import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CommandFactory } from 'nest-commander';

async function bootstrap() {
  await CommandFactory.run(AppModule, ["debug", "error", "log", "warn", "fatal", "verbose"]);
}
bootstrap();
