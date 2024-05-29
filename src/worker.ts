import type { Redis } from "ioredis";
import { type Job, Queue, Worker } from "bullmq";
import type { AppHandler } from "./app.command";
import type { pino } from "pino";
import type { Logger } from "@nestjs/common";

const QUEUE_NAME = "default";

export function getWorker(app: AppHandler, redis: Redis, logger: Logger, concurrency = 1) {
    const worker = new Worker(
        QUEUE_NAME,
        async (job: Job) => {
            if (job.name === "reconcile") {
                const start = Date.now();
                const fids = job.data.fids as number[];
                await app.reconcileFids(fids);
                const elapsed = (Date.now() - start) / 1000;
                const lastFid = fids[fids.length - 1];
                logger.log(`Reconciled ${fids.length} upto ${lastFid} in ${elapsed}s at ${new Date().toISOString()}`);
            } else if (job.name === "completionMarker") {
                // TODO: Update key in redis so event streaming can start
                const startedAt = new Date(job.data.startedAt as number);
                const duration = (Date.now() - startedAt.getTime()) / 1000 / 60;
                logger.log(
                    `Reconciliation started at ${startedAt.toISOString()} complete at ${new Date().toISOString()} ${duration} minutes`,
                );
            }
        },
        {
            autorun: false, // Don't start yet
            useWorkerThreads: concurrency > 1,
            concurrency,
            connection: redis,
            removeOnComplete: { count: 100 }, // Keep at most this many completed jobs
            removeOnFail: { count: 100 }, // Keep at most this many failed jobs
        },
    );

    return worker;
}

export function getQueue(redis: Redis) {
    return new Queue("default", {
        connection: redis,
        defaultJobOptions: { attempts: 3, backoff: { delay: 1000, type: "exponential" } },
    });
}