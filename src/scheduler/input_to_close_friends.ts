import { isDocument } from "@typegoose/typegoose";
import { IOManager } from "../stdlib/io-manager";
import { SchedulerRuntimeFunction } from "../stdlib/scheduler";
import { Input } from "../types";
import { Interaction } from "../data/interaction";
import { IOChannel } from "../data/io-channel";
import { Person } from "../data/person";

const EXTRACT_LAST_DAYS = 7;
const MAX_INTERACTIONS = 3;

const MIN_HOUR = 9;
const MAX_HOUR = 22;

export default class InputToCloseFriendsScheduler extends SchedulerRuntimeFunction {
  // Based on the ioChanneID, generate a unique hour:sec every day that will be used to schedule the input
  // The input time should change every day and it must be unique per day, so we don't contact the same people at the same time or twice
  // Also, make sure the time is between X and Y
  generateUniqueHourAndMinute(ioChannelID: string): string {
    // Get current date as YYYYMMDD
    const date = new Date();
    const dateString = date.toISOString().split("T")[0];

    // Create a hash from ioChanneID and date to ensure uniqueness per day
    const hash = this.hashCode(ioChannelID + dateString);

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
    const { programArgs } = this.job;

    // Starting from "Interactions", get the most popular in the last 7 days and extract the ioChannels
    // of the people who interacted with them
    const data = await Interaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - EXTRACT_LAST_DAYS * 24 * 60 * 60 * 1000),
          },
          input: { $exists: true },
        },
      },
      {
        $group: {
          _id: "$ioChannel",
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

    const currentHourAndMinute = new Date().getHours() + ":" + new Date().getMinutes();

    for (const interaction of data) {
      const ioChannelId = interaction._id;
      const time = this.generateUniqueHourAndMinute(ioChannelId);
      if (time !== currentHourAndMinute) continue;

      const ioChannel = await IOChannel.findById(ioChannelId);
      if (!isDocument(ioChannel)) {
        throw new Error(`Invalid ioChannel: ${ioChannelId}`);
      }

      const person = await Person.findById(ioChannel.person);
      if (!isDocument(person)) {
        throw new Error(`Invalid person for ioChannel: ${ioChannelId}`);
      }

      return IOManager.getInstance().input(programArgs as Input, ioChannel, person, null);
    }

    return false;
  }
}
