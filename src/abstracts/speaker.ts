import { File } from "../stdlib/file";

export abstract class Speaker {
  abstract play(file: string | File): Promise<any>;
  kill() {}
}
