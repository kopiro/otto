import { isDocument } from "@typegoose/typegoose";
import { IOManager } from "../stdlib/io-manager";
import { SchedulerRuntimeFunction } from "../stdlib/scheduler";
import { Input } from "../types";
import { Interaction } from "../data/interaction";
import { IOChannel, TIOChannel } from "../data/io-channel";
import { Person, TPerson } from "../data/person";
import { TScheduler } from "../data/scheduler";
import { Signale } from "signale";
import config from "../config";
import mongoose from "mongoose";

const EXTRACT_LAST_DAYS = 7;
const MAX_INTERACTIONS = 5;

const MIN_HOUR = 9;
const MAX_HOUR = 22;

const TAG = "InputToCloseFriends";
const logger = new Signale({
  scope: TAG,
});

type IOChannelsWithTime = Array<{
  ioChannel: TIOChannel;
  person: TPerson;
  time: string;
}>;

let _ioChannelsWithTime: IOChannelsWithTime | null = null;
let _ioChannelCacheToDay: string | null = null;

export default class InputToCloseFriendsScheduler extends SchedulerRuntimeFunction {
  constructor(job: TScheduler) {
    super(job);
  }

  async getIOChannelsWithTime(): Promise<IOChannelsWithTime> {
    const day = new Date().toISOString().split("T")[0];

    if (_ioChannelCacheToDay === day && _ioChannelsWithTime !== null) {
      return _ioChannelsWithTime;
    }

    const skipPersonIds = config().scheduler.inputToCloseFriends.skipPersonIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    // Starting from "Interactions", get the most popular in the last 7 days and extract the ioChannels
    // of the people who interacted with them
    const data = await Interaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - EXTRACT_LAST_DAYS * 24 * 60 * 60 * 1000),
          },
          input: { $exists: true },
          managerUid: config().uid,
          person: { $nin: skipPersonIds },
        },
      },
      {
        $group: {
          _id: { ioChannelId: "$ioChannel", personId: "$person" },
          interactionCount: { $sum: 1 },
        },
      },
      {
        $sort: { interactionCount: -1 },
      },
      {
        $limit: MAX_INTERACTIONS,
      },
    ]);

    const ioChannelsWithTime = (
      await Promise.all(
        data.map(async (interaction) => {
          const { ioChannelId, personId } = interaction._id;

          const ioChannel = await IOChannel.findById(ioChannelId);
          if (!isDocument(ioChannel)) return null;

          const person = await Person.findById(personId);
          if (!isDocument(person)) return null;

          return {
            ioChannel,
            person,
            time: this.generateUniqueHourAndMinute(`${ioChannelId}-${personId}`),
          };
        }),
      )
    ).filter((item) => item !== null);

    _ioChannelsWithTime = ioChannelsWithTime;
    _ioChannelCacheToDay = day;

    logger.info(
      "IO Channels with time",
      day,
      ioChannelsWithTime.map((e) => ({
        ioChannel: e.ioChannel.toJSONDebug(),
        person: e.person.toJSONDebug(),
        time: e.time,
      })),
    );

    return _ioChannelsWithTime;
  }

  // Based on the ioChannelID, generate a unique hour:sec every day that will be used to schedule the input
  // The input time should change every day and it must be unique per day, so we don't contact the same people at the same time or twice
  // Also, make sure the time is between X and Y
  generateUniqueHourAndMinute(identifier: string): string {
    // Get current date as YYYYMMDD
    const date = new Date();
    const dateString = date.toISOString().split("T")[0];

    // Create a hash from ioChanneID and date to ensure uniqueness per day
    const hash = this.hashCode(identifier + dateString);

    // Generate hour and minute within allowed range (09:00 - 22:59)
    const hour = MIN_HOUR + (hash % (MAX_HOUR - MIN_HOUR));
    const minute = hash % 60;

    // Format time
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  // Simple hash function to get a number from a string
  hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async run() {
    const ioChannelsWithTime = await this.getIOChannelsWithTime();

    const { programArgs } = this.job;
    const currentHourAndMinute = new Date().getHours() + ":" + new Date().getMinutes();

    const ioChannelIdsNow = ioChannelsWithTime.filter((e) => e.time === currentHourAndMinute);
    if (!ioChannelIdsNow[0]) return false;
    const { ioChannel, person } = ioChannelIdsNow[0];

    return IOManager.getInstance().input(programArgs as Input, ioChannel, person, null);
  }
}
