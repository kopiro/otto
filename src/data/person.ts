import { Authorization, Language } from "../types";
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

  @prop({ required: true })
  public language!: Language;

  @prop({ required: true, type: [String] })
  public authorizations?: Authorization[];

  @prop({ required: true, type: mongoose.Schema.Types.Mixed })
  public ioIdentifiers!: Record<IODriverId, string>;

  @prop({ required: false })
  public useForReporting?: boolean;

  public toJSONDebug() {
    return {
      id: this.id,
      name: this.getName(),
    };
  }

  public getName() {
    return this.name;
  }

  public toJSONAPI() {
    return {
      id: this.id,
      name: this.getName(),
      language: this.language,
      authorizations: this.authorizations,
      ioIdentifiers: this.ioIdentifiers,
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
      language: language || config().language,
      ioIdentifiers: {
        [ioDriver]: ioIdentifier,
      },
    });

    logger.info("New Person registered", newPerson);

    return newPerson;
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
