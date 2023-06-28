import { Authorizations, Language } from "../types";
import { getModelForClass, Ref, ReturnModelType, DocumentType, prop, modelOptions } from "@typegoose/typegoose";

import { Signale } from "signale";
import { IODriverId } from "../stdlib/io-manager";
import config from "../config";

const TAG = "Person";
const logger = new Signale({
  scope: TAG,
});

@modelOptions({ schemaOptions: { collection: "persons" } })
export class IPerson {
  @prop()
  public name!: string;

  @prop()
  public language!: Language;

  @prop({ type: () => [String] })
  public authorizations?: Authorizations[];

  @prop()
  public ioIdentifiers: Record<IODriverId, string>;

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
  ): Promise<TPerson> {
    return Person.findOne({
      [`ioIdentifiers.${ioDriver}`]: ioIdentifier,
    });
  }
}

export const Person = getModelForClass(IPerson);
export type TPerson = DocumentType<IPerson>;
