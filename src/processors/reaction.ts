import { type Message, fromFarcasterTime } from "@farcaster/hub-nodejs";
import { formatReactions } from "./utils";
import type { AppDb } from "../db";
import { log } from "../log";
import { MESSAGE_REACTION_ADD_TOPIC, MESSAGE_REACTION_REMOVE_TOPIC } from "../env";
import type { PubSub } from "@google-cloud/pubsub";

/**
 * Insert a reaction in the database
 * @param msg Hub event in JSON format
 */
export async function insertReactions(msgs: Message[], db: AppDb, pubsub: PubSub) {
  const reactions = formatReactions(msgs);

  try {
    await db
      .insertInto("reactions")
      .values(reactions)
      .onConflict((oc) => oc.column("hash").doNothing())
      .execute();

    log.debug("REACTIONS INSERTED");

    for (const msg of msgs) {
      pubsub.topic(MESSAGE_REACTION_ADD_TOPIC).publishMessage({ data: Buffer.from(JSON.stringify(msg)) }, (err, message) => {
        if (err) {
          log.error(err, "ERROR PUBLISHING MESSAGE");
        }
        log.debug(`Message published: ${message}`);
      });
    }
  } catch (error) {
    log.error(error, "ERROR INSERTING REACTIONS");
  }
}

export async function deleteReactions(msgs: Message[], db: AppDb, pubsub: PubSub) {
  try {
    for (const msg of msgs) {
      const data = msg.data;
      const reaction = data.reactionBody;

      if (reaction.targetCastId) {
        await db
          .updateTable("reactions")
          .set({
            deletedAt: new Date(
              fromFarcasterTime(data.timestamp)._unsafeUnwrap()
            ),
          })
          .where("fid", "=", data.fid)
          .where("type", "=", reaction.type)
          .where("targetCastHash", "=", reaction.targetCastId.hash)
          .execute();
      } else if (reaction.targetUrl) {
        await db
          .updateTable("reactions")
          .set({
            deletedAt: new Date(
              fromFarcasterTime(data.timestamp)._unsafeUnwrap()
            ),
          })
          .where("fid", "=", data.fid)
          .where("type", "=", reaction.type)
          .where("targetUrl", "=", reaction.targetUrl)
          .execute();
      }
    }

    log.debug("REACTIONS DELETED");

    for (const msg of msgs) {
      pubsub.topic(MESSAGE_REACTION_REMOVE_TOPIC).publishMessage({ data: Buffer.from(JSON.stringify(msg)) }, (err, message) => {
        if (err) {
          log.error(err, "ERROR PUBLISHING MESSAGE");
        }
        log.debug(`Message published: ${message}`);
      });
    }
  } catch (error) {
    log.error(error, "ERROR DELETING REACTION");
  }
}
