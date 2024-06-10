import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CommandFactory } from 'nest-commander';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.listen(8080, '0.0.0.0', () => {
    Logger.log('HTTP server running on http://0.0.0.0:8080');
  });
  
  await CommandFactory.run(AppModule, ["debug", "error", "log", "warn", "fatal", "verbose"]);
}
bootstrap();
