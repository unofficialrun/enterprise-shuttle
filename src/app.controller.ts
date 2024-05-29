import { Controller, Get, Logger } from "@nestjs/common";
import { InjectKysely } from "nestjs-kysely";
import type { DB } from "@farcaster/shuttle";
// biome-ignore lint/style/useImportType: dependecy injection
import { AppService } from "./app.service";

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(
    @InjectKysely() private readonly db: DB,
    private readonly appService: AppService,
  ) {}

  @Get()
  async getMessages(): Promise<string> {
    const result = await this.db
      .selectFrom("messages").selectAll().limit(5).execute();

    this.logger.debug(result);

    return JSON.stringify(result);
  }

  @Get("start")
  async start(): Promise<string> {
    this.logger.debug("Starting messages");

    this.appService.start();

    return JSON.stringify({ status: "starting" });
  }

  @Get("backfill")
  async backfill(): Promise<string> {
    this.logger.debug("Backfilling messages");

    this.appService.backfill();

    return JSON.stringify({ status: "backfilling" });
  }

  @Get("worker")
  async worker(): Promise<string> {
    this.logger.debug("Starting worker");

    this.appService.worker();

    return JSON.stringify({ status: "worker" });
  }
}