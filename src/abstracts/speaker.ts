import { File } from "../stdlib/file";

export abstract class Speaker {
  abstract async play(file: string | File): Promise<any>;
  kill() {}
}
