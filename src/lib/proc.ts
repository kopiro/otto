import { spawn as systemSpawn } from "child_process";

const TAG = "Proc";

export function spawn(program: string, args: Array<any> = []): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(TAG, program, args.join(" "));

    const spawned = systemSpawn(program, args);

    let stdout = "";
    let stderr = "";

    spawned.stdout.on("data", (buf) => {
      stdout += buf;
    });

    spawned.stderr.on("data", (buf) => {
      stderr += buf;
    });

    spawned.on("close", (err) => {
      err ? reject(stderr) : resolve(stdout);
    });
  });
}
