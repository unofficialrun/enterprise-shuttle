import type { Message } from '@farcaster/hub-nodejs'
import { formatUserDatas } from './utils'
import type { AppDb } from '../db'
import { log } from '../log'
import { MESSAGE_USER_DATA_ADD_TOPIC } from '../env'
import type { PubSub } from '@google-cloud/pubsub'

export async function insertUserDatas(msgs: Message[], db: AppDb, pubsub: PubSub) {
  const userDatas = formatUserDatas(msgs)

  try {
    await db
      .insertInto('userData')
      .values(userDatas)
      .onConflict((oc) =>
        oc.columns(['fid', 'type']).doUpdateSet((eb) => ({
          value: eb.ref('excluded.value'),
        }))
      )
      .execute()

    log.debug("USER DATA INSERTED")

    for (const msg of msgs) {
      pubsub.topic(MESSAGE_USER_DATA_ADD_TOPIC).publishMessage({ data: Buffer.from(JSON.stringify(msg)) }, (err, message) => {
        if (err) {
          log.error(err, "ERROR PUBLISHING MESSAGE");
        }
        log.debug(`Message published: ${message}`);
      });
    }
  } catch (error) {
    log.error(error, 'ERROR INSERTING USER DATA')
  }
}
