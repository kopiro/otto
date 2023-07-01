// @ts-ignore
import isPi from "detect-rpi";

export type Platform = "pi" | "macos" | "unknown";

export function getPlatform(): Platform {
  switch (true) {
    case isPi():
      return "pi";
    case process.platform === "darwin":
      return "macos";
    default:
      return "unknown";
  }
}
