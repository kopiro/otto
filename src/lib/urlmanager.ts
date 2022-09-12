import * as Proc from "./proc";

export async function open(url: string) {
  // TODO: handle errors
  // TODO: handle multiplatform
  Proc.spawn("open", [url]);
}
