import { ChildProcess, spawn as systemSpawn } from "child_process";

import { Signale } from "signale";

const TAG = "Proc";
const console = new Signale({
  scope: TAG,
});

export function spawn(program: string, args: Array<any> = []): { child: ChildProcess; result: Promise<string> } {
  console.log(program, args.join(" "));

  const child = systemSpawn(program, args);

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (buf) => {
    stdout += buf;
  });

  child.stderr.on("data", (buf) => {
    stderr += buf;
  });

  const result = new Promise<string>((resolve, reject) => {
    child.on("close", (err) => {
      if (err) {
        reject(stderr);
        return;
      }
      resolve(stdout);
    });
  });

  return { child, result };
}
