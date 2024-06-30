import { type Message, fromFarcasterTime } from "@farcaster/hub-nodejs";
import type { AppDb } from "../db";
import { formatVerifications } from "./utils";
import { log } from "../log";
import { MESSAGE_VERIFICATION_ADD_ETH_TOPIC, MESSAGE_VERIFICATION_REMOVE_TOPIC } from "../env";
import type { PubSub } from "@google-cloud/pubsub";

/**
 * Insert a new verification in the database
 * @param msg Hub event in JSON format
 */
export async function insertVerifications(msgs: Message[], db: AppDb, pubsub: PubSub) {
  const verifications = formatVerifications(msgs);

  try {
    await db
      .insertInto("verifications")
      .values(verifications)
      .onConflict((oc) => oc.columns(["fid", "signerAddress"]).doNothing())
      .execute();

    log.debug("VERIFICATIONS INSERTED");

    for (const msg of msgs) {
      pubsub.topic(MESSAGE_VERIFICATION_ADD_ETH_TOPIC).publishMessage({ data: Buffer.from(JSON.stringify(msg)) }, (err, message) => {
        if (err) {
          log.error(err, "ERROR PUBLISHING MESSAGE");
        }
        log.debug(`Message published: ${message}`);
      });
    }
  } catch (error) {
    log.error(error, "ERROR INSERTING VERIFICATION");
  }
}

/**
 * Delete a verification from the database
 * @param msg Hub event in JSON format
 */
export async function deleteVerifications(msgs: Message[], db: AppDb, pubsub: PubSub) {
  try {
    for (const msg of msgs) {
      const data = msg.data;
      const address = data.verificationRemoveBody.address;

      await db
        .updateTable("verifications")
        .set({
          deletedAt: new Date(
            fromFarcasterTime(data.timestamp)._unsafeUnwrap()
          ),
        })
        .where("signerAddress", "=", address)
        .where("fid", "=", data.fid)
        .execute();
    }

    log.debug("VERIFICATIONS DELETED");

    for (const msg of msgs) {
      pubsub.topic(MESSAGE_VERIFICATION_REMOVE_TOPIC).publishMessage({ data: Buffer.from(JSON.stringify(msg)) }, (err, message) => {
        if (err) {
          log.error(err, "ERROR PUBLISHING MESSAGE");
        }
        log.debug(`Message published: ${message}`);
      });
    }
  } catch (error) {
    log.error(error, "ERROR DELETING VERIFICATION");
  }
}
