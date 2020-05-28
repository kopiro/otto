export abstract class Speaker {
  abstract async playURI(uri: string): Promise<any>;
  kill() {
    console.error("Killing...");
  }
}
