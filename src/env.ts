import "dotenv/config";

export const COLORIZE =
    process.env["COLORIZE"] === "true" ? true : process.env["COLORIZE"] === "false" ? false : process.stdout.isTTY;
export const LOG_LEVEL = process.env["LOG_LEVEL"] || "info";

export const HUB_HOST = process.env["HUB_HOST"] || "localhost:2283";
export const HUB_SSL = process.env["HUB_SSL"] === "true";

export const DATABASE_URL = process.env["DATABASE_URL"] || "postgres://localhost:5432";
export const REDIS_URL = process.env["REDIS_URL"] || "redis://localhost:6379";

export const REDISHOST = process.env["REDISHOST"] || "localhost";
export const REDISPORT = Number.parseInt(process.env["REDISPORT"] || "6379");

export const TOTAL_SHARDS = Number.parseInt(process.env["SHARDS"] || "0");
export const SHARD_INDEX = Number.parseInt(process.env["SHARD_NUM"] || "0");

export const BACKFILL_FIDS = process.env["FIDS"] || "";
export const MAX_FID = process.env["MAX_FID"];

export const STATSD_HOST = process.env["STATSD_HOST"];
export const STATSD_METRICS_PREFIX = process.env["STATSD_METRICS_PREFIX"] || "shuttle.";

export const CONCURRENCY = Number.parseInt(process.env["CONCURRENCY"] || "2");

// Topics
export const MESSAGE_CAST_ADD_TOPIC = process.env["MESSAGE_CAST_ADD_TOPIC"] || "message-cast-add-dev";
export const MESSAGE_CAST_REMOVE_TOPIC = process.env["MESSAGE_CAST_REMOVE_TOPIC"] || "message-cast-remove-dev";

export const MESSAGE_LINK_ADD_TOPIC = process.env["MESSAGE_LINK_ADD_TOPIC"] || "message-link-add-dev";
export const MESSAGE_LINK_REMOVE_TOPIC = process.env["MESSAGE_LINK_REMOVE_TOPIC"] || "message-link-remove-dev";

export const MESSAGE_REACTION_ADD_TOPIC = process.env["MESSAGE_REACTION_ADD_TOPIC"] || "message-reaction-add-dev";
export const MESSAGE_REACTION_REMOVE_TOPIC = process.env["MESSAGE_REACTION_REMOVE_TOPIC"] || "message-reaction-remove-dev";

export const MESSAGE_USER_DATA_ADD_TOPIC = process.env["MESSAGE_USER_DATA_ADD_TOPIC"] || "message-user-data-add-dev";

export const MESSAGE_VERIFICATION_ADD_ETH_TOPIC = process.env["MESSAGE_VERIFICATION_ADD_ETH_TOPIC"] || "message-verification-add-eth-dev";
export const MESSAGE_VERIFICATION_REMOVE_TOPIC = process.env["MESSAGE_VERIFICATION_REMOVE"] || "message-verification-remove-dev";