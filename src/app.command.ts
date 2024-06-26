import { log } from './log';
import {
  type DB,
  getHubClient,
  type MessageHandler,
  type StoreMessageOperation,
  MessageReconciliation,
  RedisClient,
  HubEventProcessor,
  EventStreamHubSubscriber,
  EventStreamConnection,
  HubEventStreamConsumer,
  type HubSubscriber,
  type MessageState,
} from "@farcaster/shuttle";
import {
  BACKFILL_FIDS,
  CONCURRENCY,
  HUB_HOST,
  HUB_SSL,
  MAX_FID,
  DATABASE_URL,
  REDISHOST,
  REDISPORT,
  SHARD_INDEX,
  TOTAL_SHARDS,
} from "./env";
import { bytesToHexString, type HubEvent, type Message, MessageType } from "@farcaster/hub-nodejs";
import { ok } from "neverthrow";
import type { Queue } from "bullmq";
import { type AppDb, migrateToLatest } from "./db";
import { getQueue, getWorker } from "./worker";
import { InjectKysely } from 'nestjs-kysely';
import { insertCasts, deleteCasts } from './processors/cast';
import { insertLinks, deleteLinks } from './processors/link';
import { insertReactions, deleteReactions } from './processors/reaction';
import { insertUserDatas } from './processors/user-data';
import { insertVerifications, deleteVerifications } from './processors/verification';
import { Command, CommandRunner } from 'nest-commander';
import { PubSub } from '@google-cloud/pubsub';

@Command({ name: 'shuttle', arguments: '<task>', description: 'Manage the shuttle tasks' })
export class AppShuttleCommand extends CommandRunner {

  constructor(@InjectKysely() private readonly db: DB) {
    super();
  }

  async run(passedParam: string[]) {
    const task = passedParam[0];

    switch (task) {
      case 'start':
        await this.start();
        break;
      case 'backfill':
        await this.backfill();
        break;
      case 'worker':
        await this.worker();
        break;
      case 'health':
        log.info("Health check passed");
        break;
      default:
        log.error(`Unknown task: ${task}`);
    }
  }

  private async start() {
    log.info(`Creating app connecting to: ${DATABASE_URL}, ${REDISHOST}:${REDISPORT}, ${HUB_HOST}`);
    const app = AppHandler.create(this.db, `${REDISHOST}:${REDISPORT}`, HUB_HOST, TOTAL_SHARDS, SHARD_INDEX, HUB_SSL);
    log.info("Starting shuttle");
    await app.start();
  }

  private async backfill() {
    log.info("Starting backfill task");
    log.debug(`Creating app connecting to: ${DATABASE_URL}, ${REDISHOST}:${REDISPORT}, ${HUB_HOST}`);
    const app = AppHandler.create(this.db, `${REDISHOST}:${REDISPORT}`, HUB_HOST, TOTAL_SHARDS, SHARD_INDEX, HUB_SSL);
    log.debug("Starting shuttle");
    const fids = BACKFILL_FIDS ? BACKFILL_FIDS.split(",").map((fid) => Number.parseInt(fid)) : [];
    log.info(`Backfilling fids: ${fids}`);
    const backfillQueue = getQueue(app.redis.client);
    await app.backfillFids(fids, backfillQueue);

    // Start the worker after initiating a backfill
    const worker = getWorker(app, app.redis.client, log, CONCURRENCY);
    await worker.run();
  }

  private async worker() {
    log.info(`Starting worker connecting to: ${DATABASE_URL}, ${REDISHOST}:${REDISPORT}, ${HUB_HOST}`);
    const app = AppHandler.create(this.db, `${REDISHOST}:${REDISPORT}`, HUB_HOST, TOTAL_SHARDS, SHARD_INDEX, HUB_SSL);
    const worker = getWorker(app, app.redis.client, log, CONCURRENCY);
    await worker.run();
  }
}

const hubId = "shuttle";

export class AppHandler implements MessageHandler {
  private readonly db: DB;
  private hubSubscriber: HubSubscriber;
  private streamConsumer: HubEventStreamConsumer;
  public redis: RedisClient;
  private readonly hubId: string;
  private pubsub: PubSub;

  constructor(db: DB, redis: RedisClient, hubSubscriber: HubSubscriber, streamConsumer: HubEventStreamConsumer, pubsub: PubSub) {
    this.db = db;
    this.redis = redis;
    this.hubSubscriber = hubSubscriber;
    this.hubId = hubId;
    this.streamConsumer = streamConsumer;
    this.pubsub = pubsub;
  }

  static create(
    dbRemote: DB,
    redisUrl: string,
    hubUrl: string,
    totalShards: number,
    shardIndex: number,
    hubSSL = false,
  ) {
    const db = dbRemote // getDbClient(dbUrl);
    const hub = getHubClient(hubUrl, { ssl: hubSSL });
    const redis = RedisClient.create(redisUrl);
    const eventStreamForWrite = new EventStreamConnection(redis.client);
    const eventStreamForRead = new EventStreamConnection(redis.client);
    const shardKey = totalShards === 0 ? "all" : `${shardIndex}`;
    const hubSubscriber = new EventStreamHubSubscriber(
      hubId,
      hub,
      eventStreamForWrite,
      redis,
      shardKey,
      log,
      undefined,
      totalShards,
      shardIndex,
    );
    const streamConsumer = new HubEventStreamConsumer(hub, eventStreamForRead, shardKey);
    const pubsub = new PubSub();

    return new AppHandler(db, redis, hubSubscriber, streamConsumer, pubsub);
  }

  static async processMessagesOfType(messages: Message[], type: MessageType, db: AppDb, pubsub: PubSub): Promise<void> {
    if (type === MessageType.CAST_ADD) {
      await insertCasts(messages, db, pubsub)
    } else if (type === MessageType.CAST_REMOVE) {
      await deleteCasts(messages, db, pubsub)
    } else if (type === MessageType.VERIFICATION_ADD_ETH_ADDRESS) {
      await insertVerifications(messages, db, pubsub)
    } else if (type === MessageType.VERIFICATION_REMOVE) {
      await deleteVerifications(messages, db, pubsub)
    } else if (type === MessageType.USER_DATA_ADD) {
      await insertUserDatas(messages, db, pubsub)
    } else if (type === MessageType.REACTION_ADD) {
      await insertReactions(messages, db, pubsub)
    } else if (type === MessageType.REACTION_REMOVE) {
      await deleteReactions(messages, db, pubsub)
    } else if (type === MessageType.LINK_ADD) {
      await insertLinks(messages, db, pubsub)
    } else if (type === MessageType.LINK_REMOVE) {
      await deleteLinks(messages, db, pubsub)
    }
  }

  async handleMessagesMergeOfType(
    messages: Message[],
    type: MessageType,
    txn: DB,
    // Assume this is always merge and missed and new
    // operation: StoreMessageOperation,
    // state: MessageState,
    // isNew: boolean,
    // wasMissed: boolean,
  ): Promise<void> {
    const appDB = txn as unknown as AppDb;

    if (messages.length > 0)
      await AppHandler.processMessagesOfType(messages, type, appDB, this.pubsub);
  }

  async handleMessageMerge(
    message: Message,
    txn: DB,
    operation: StoreMessageOperation,
    state: MessageState,
    isNew: boolean,
    wasMissed: boolean,
  ): Promise<void> {
    if (!isNew) {
      // Message was already in the db, no-op
      return;
    }

    const appDB = txn as unknown as AppDb; // Need this to make typescript happy, not clean way to "inherit" table types

    // Example of how to materialize casts into a separate table. Insert casts into a separate table, and mark them as deleted when removed
    // Note that since we're relying on "state", this can sometimes be invoked twice. e.g. when a CastRemove is merged, this call will be invoked 2 twice:
    // castAdd, operation=delete, state=deleted (the cast that the remove is removing)
    // castRemove, operation=merge, state=deleted (the actual remove message)
    if (message.data?.type)
      await AppHandler.processMessagesOfType([message], message.data?.type, appDB, this.pubsub);

    const messageDesc = wasMissed ? `missed message (${operation})` : `message (${operation})`;
    log.debug(`${state} ${messageDesc} ${bytesToHexString(message.hash)._unsafeUnwrap()} (type ${message.data?.type})`);
  }

  async start() {
    await this.ensureMigrations();
    // Hub subscriber listens to events from the hub and writes them to a redis stream. This allows for scaling by
    // splitting events to multiple streams
    await this.hubSubscriber.start();

    // Sleep 10 seconds to give the subscriber a chance to create the stream for the first time.
    await new Promise((resolve) => setTimeout(resolve, 10_000));

    log.debug("Starting stream consumer");
    // Stream consumer reads from the redis stream and inserts them into postgres
    await this.streamConsumer.start(async (event) => {
      void this.processHubEvent(event);
      return ok({ skipped: false });
    });
  }

  async reconcileFids(fids: number[]) {
    // biome-ignore lint/style/noNonNullAssertion: client is always initialized
    const reconciler = new MessageReconciliation(this.hubSubscriber.hubClient!, this.db, log);
    for (const fid of fids) {
      await reconciler.reconcileMessagesForFid(
        fid,
        async (message, missingInDb, prunedInDb, revokedInDb) => {
          if (missingInDb) {
            await HubEventProcessor.handleMissingMessage(this.db, message, this);
          } else if (prunedInDb || revokedInDb) {
            const messageDesc = prunedInDb ? "pruned" : revokedInDb ? "revoked" : "existing";
            log.info(`Reconciled ${messageDesc} message ${bytesToHexString(message.hash)._unsafeUnwrap()}`);
          }
        },
        async (message, missingInHub) => {
          if (missingInHub) {
            log.info(`Message ${bytesToHexString(message.hash)._unsafeUnwrap()} is missing in the hub`);
          }
        },
      );
    }
  }

  async backfillFids(fids: number[], backfillQueue: Queue) {
    await this.ensureMigrations();
    const startedAt = Date.now();
    if (fids.length === 0) {
      const maxFidResult = await this.hubSubscriber.hubClient?.getFids({ pageSize: 1, reverse: true });

      if (maxFidResult === undefined) {
        log.error("Hub client is not initialized");
        throw new Error("Hub client is not initialized");
      }

      if (maxFidResult.isErr()) {
        log.error("Failed to get max fid", maxFidResult.error);
        throw maxFidResult.error;
      }
      const maxFid = MAX_FID ? Number.parseInt(MAX_FID) : maxFidResult.value.fids[0];
      if (!maxFid) {
        log.error("Max fid was undefined");
        throw new Error("Max fid was undefined");
      }
      log.debug(`Queuing up fids upto: ${maxFid}`);
      // create an array of arrays in batches of 100 upto maxFid
      const batchSize = 10;
      const fids = Array.from({ length: Math.ceil(maxFid / batchSize) }, (_, i) => i * batchSize).map((fid) => fid + 1);
      for (const start of fids) {
        const subset = Array.from({ length: batchSize }, (_, i) => start + i);
        await backfillQueue.add("reconcile", { fids: subset });
      }
    } else {
      await backfillQueue.add("reconcile", { fids });
    }
    await backfillQueue.add("completionMarker", { startedAt });
    log.debug("Backfill jobs queued");
  }

  private async processHubEvent(hubEvent: HubEvent) {
    await HubEventProcessor.processHubEvent(this.db, hubEvent, this);
  }

  async ensureMigrations() {
    const result = await migrateToLatest(this.db, log);
    if (result.isErr()) {
      log.debug("Failed to migrate database", result.error);
      throw result.error;
    }
  }

  async stop() {
    this.hubSubscriber.stop();
    const lastEventId = await this.redis.getLastProcessedEvent(this.hubId);
    log.info(`Stopped at eventId: ${lastEventId}`);
  }
}
