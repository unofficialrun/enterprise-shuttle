import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CommandFactory } from 'nest-commander';
import { Logger } from '@nestjs/common';
import * as portfinder from 'portfinder';

async function bootstrap() {
  try {
    // Check if port 8080 is available
    const port = await portfinder.getPortPromise({ port: 8080 });

    if (port === 8080) {
      // Start HTTP server if port 8080 is available
      const app = await NestFactory.create(AppModule);
      const server = app.listen(8080, '0.0.0.0', () => {
        Logger.log('HTTP server running on http://0.0.0.0:8080');
      });

      // Run command-line functionality
      const commands = CommandFactory.run(AppModule, ["debug", "error", "log", "warn", "fatal", "verbose"]);

      await Promise.all([server, commands]);
    } else {
      Logger.warn('Port 8080 is already in use. HTTP server will not be started.');
      // Run command-line functionality without starting the server
      await CommandFactory.run(AppModule, ["debug", "error", "log", "warn", "fatal", "verbose"]);
    }
  } catch (error) {
    Logger.error('Error checking port 8080:', error);
  }
}

bootstrap();
