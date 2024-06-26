import { type Message, fromFarcasterTime } from "@farcaster/hub-nodejs";

import { formatCasts } from "./utils.js";
import type { AppDb } from "../db.js";
import { log } from "../log.js";
import type { PubSub } from "@google-cloud/pubsub";
import { MESSAGE_CAST_ADD_TOPIC, MESSAGE_CAST_REMOVE_TOPIC } from "../env";

/**
 * Insert casts in the database
 * @param msg Hub event in JSON format
 */
export async function insertCasts(msgs: Message[], db: AppDb, pubsub: PubSub) {
  const casts = formatCasts(msgs);

  try {
    await db
      .insertInto("casts")
      .values(casts)
      .onConflict((oc) => oc.column("hash").doNothing())
      .execute();

    log.debug("CASTS INSERTED");

    for (const msg of msgs) {
      pubsub.topic(MESSAGE_CAST_ADD_TOPIC).publishMessage({ data: Buffer.from(JSON.stringify(msg)) }, (err, message) => {
        if (err) {
          log.error(err, "ERROR PUBLISHING MESSAGE");
        }
        log.debug(`Message published: ${message}`);
      });
    }
  } catch (error) {
    log.error(error, "ERROR INSERTING CAST");
  }
}

/**
 * Update a cast in the database
 * @param hash Hash of the cast
 * @param change Object with the fields to update
 */
export async function deleteCasts(msgs: Message[], db: AppDb, pubsub) {
  try {
    for (const msg of msgs) {
      const data = msg.data;

      await db
        .updateTable("casts")
        .set({
          deletedAt: new Date(
            fromFarcasterTime(data.timestamp)._unsafeUnwrap()
          ),
        })
        .where("hash", "=", data.castRemoveBody?.targetHash)
        .execute();
    }

    log.debug("CASTS DELETED");

    for (const msg of msgs) {
      pubsub.topic(MESSAGE_CAST_REMOVE_TOPIC).publishMessage({ data: Buffer.from(JSON.stringify(msg)) }, (err, message) => {
        if (err) {
          log.error(err, "ERROR PUBLISHING MESSAGE");
        }
        log.debug(`Message published: ${message}`);
      });
    }
  } catch (error) {
    log.error(error, "ERROR DELETING CAST");
  }
}
