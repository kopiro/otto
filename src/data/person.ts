import { API_Person, Authorization, EmotionContext, Language } from "../types";
import { getModelForClass, Ref, ReturnModelType, DocumentType, prop, modelOptions } from "@typegoose/typegoose";

import { Signale } from "signale";
import { IODriverId } from "../stdlib/io-manager";
import config from "../config";
import mongoose from "mongoose";

const TAG = "Person";
const logger = new Signale({
  scope: TAG,
});

@modelOptions({ schemaOptions: { collection: "persons" }, options: { allowMixed: 0 } })
export class IPerson {
  public id!: string;

  @prop({ required: true })
  public name!: string;

  @prop({ required: false })
  public language?: Language;

  @prop({ required: true, type: [String] })
  public authorizations?: Authorization[];

  @prop({ required: true, type: mongoose.Schema.Types.Mixed })
  public ioIdentifiers!: Record<IODriverId, string>;

  @prop({
    required: false,
    type: mongoose.Schema.Types.Mixed,
    set: (newEmotions: EmotionContext) => {
      if (!newEmotions) return newEmotions;
      const validEmotions = Object.keys(config().brain.startEmotions);
      return Object.fromEntries(
        Object.entries(newEmotions)
          .filter(([key]) => validEmotions.includes(key))
          .map(([key, value]) => [key, Math.max(0, Math.min(100, Math.round(value)))]),
      );
    },
  })
  public emotions?: EmotionContext;

  public getName() {
    return this.name;
  }

  public getEmotions() {
    if (!this.emotions || typeof this.emotions !== "object") {
      // Return a balanced emotions map
      return config().brain.startEmotions;
    }
    return this.emotions;
  }

  public toJSONDebug() {
    return {
      id: this.id,
      name: this.getName(),
      emotions: this.getEmotions(),
    };
  }

  public toJSONAPI(): API_Person {
    return {
      id: this.id,
      name: this.getName(),
      language: this.language,
      emotions: this.getEmotions(),
    };
  }

  static async findByIdOrThrow(this: ReturnModelType<typeof IPerson>, id: string): Promise<TPerson> {
    const person = await Person.findById(id);
    if (!person) throw new Error(`Person <${id}> not found`);
    return person;
  }

  static async findByIOIdentifierOrCreate(
    this: ReturnModelType<typeof IPerson>,
    ioDriver: IODriverId,
    ioIdentifier: string,
    name: string,
    language: string,
  ): Promise<TPerson> {
    const person = await Person.findByIOIdentifier(ioDriver, ioIdentifier);
    if (person) {
      // Update IO Identifier
      person.ioIdentifiers[ioDriver] = ioIdentifier;
      await person.save();
      return person;
    }

    const newPerson = await Person.create({
      name: name,
      language: language,
      ioIdentifiers: {
        [ioDriver]: ioIdentifier,
      },
    });

    logger.info("New Person registered", newPerson);

    return newPerson;
  }

  getLanguage() {
    return this.language ?? config().language;
  }

  static async findByIOIdentifier(
    this: ReturnModelType<typeof IPerson>,
    ioDriver: IODriverId,
    ioIdentifier: string,
  ): Promise<TPerson | null> {
    return Person.findOne({
      [`ioIdentifiers.${ioDriver}`]: ioIdentifier,
    });
  }
}

export const Person = getModelForClass(IPerson);
export type TPerson = DocumentType<IPerson>;
