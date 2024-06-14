import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CommandFactory } from 'nest-commander';
import { Logger } from '@nestjs/common';
import * as net from 'node:net';

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      .once('error', (err: any) => (err.code === 'EADDRINUSE' ? resolve(false) : resolve(true)))
      .once('listening', () => tester.once('close', () => resolve(true)).close())
      .listen(port);
  });
}

async function bootstrap() {
  const isPortAvailable = await checkPort(8080);

  if (isPortAvailable) {
    try {
      const app = await NestFactory.create(AppModule);
      const server = app.listen(8080, '0.0.0.0', () => {
        Logger.log('HTTP server running on http://0.0.0.0:8080');
      });

      // Run command-line functionality
      const commands = CommandFactory.run(AppModule, ["debug", "error", "log", "warn", "fatal", "verbose"]);

      await Promise.all([server, commands]);
    } catch (error) {
      Logger.error('Error starting Nest application:', error);
    }
  } else {
    Logger.warn('Port 8080 is already in use. HTTP server will not be started.');
    // Run command-line functionality without starting the server
    await CommandFactory.run(AppModule, ["debug", "error", "log", "warn", "fatal", "verbose"]);
  }
}

bootstrap();
