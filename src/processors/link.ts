import { type Message, fromFarcasterTime } from "@farcaster/hub-nodejs";
import type { AppDb } from "../db";
import { formatLinks } from "./utils";
import { log } from "../log";
import type { PubSub } from "@google-cloud/pubsub";
import { MESSAGE_LINK_ADD_TOPIC, MESSAGE_LINK_REMOVE_TOPIC } from "../env";

export async function insertLinks(msgs: Message[], db: AppDb, pubsub: PubSub) {
  const links = formatLinks(msgs);

  try {
    await db
      .insertInto("links")
      .values(links)
      .onConflict((oc) => oc.column("hash").doNothing())
      .execute();

    log.debug("LINKS INSERTED");

    for (const msg of msgs) {
      pubsub.topic(MESSAGE_LINK_ADD_TOPIC).publishMessage({ data: Buffer.from(JSON.stringify(msg)) }, (err, message) => {
        if (err) {
          log.error(err, "ERROR PUBLISHING MESSAGE");
        }
        log.debug(`Message published: ${message}`);
      });
    }
  } catch (error) {
    log.error(error, "ERROR INSERTING LINK");
  }
}

export async function deleteLinks(msgs: Message[], db: AppDb, pubsub: PubSub) {
  try {
    for (const msg of msgs) {
      const data = msg.data;

      if (data) {
        await db
          .updateTable("links")
          .set({
            deletedAt: new Date(
              fromFarcasterTime(data.timestamp)._unsafeUnwrap()
            ),
          })
          .where("fid", "=", data.fid)
          .where("targetFid", "=", data.linkBody?.targetFid)
          .execute();
      }
    }

    log.debug("LINKS DELETED");

    for (const msg of msgs) {
      pubsub.topic(MESSAGE_LINK_REMOVE_TOPIC).publishMessage({ data: Buffer.from(JSON.stringify(msg)) }, (err, message) => {
        if (err) {
          log.error(err, "ERROR PUBLISHING MESSAGE");
        }
        log.debug(`Message published: ${message}`);
      });
    }
  } catch (error) {
    log.error(error, "ERROR DELETING LINK");
  }
}
