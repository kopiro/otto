import { ChildProcess, spawn as systemSpawn } from "child_process";

import { Signale } from "signale";

const TAG = "Proc";
const logger = new Signale({
  scope: TAG,
});

export function processSpawn(
  program: string,
  args: (string | number)[] = [],
): { child: ChildProcess; result: Promise<string> } {
  logger.debug(program, args.join(" "));

  const child = systemSpawn(
    program,
    args.map((arg) => String(arg)),
  );

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
