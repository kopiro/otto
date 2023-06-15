import path from "path";
import defaultConfig from "./default-config.json";
import { readFileSync } from "fs";
import { keysDir } from "./paths";

let instance: object = null;

type TConfig = typeof defaultConfig;

function extendConfig(config: object, localConfig: object, path = ""): object {
  for (const [key, value] of Object.entries(localConfig)) {
    if (typeof value === "object" && !Array.isArray(value)) {
      if (key in config) {
        extendConfig(
          config[key as keyof typeof config],
          localConfig[key as keyof typeof localConfig],
          `${path}.${key}`,
        );
      } else {
        throw new Error(`Invalid key ${path}.${key} in config`);
      }
    } else {
      config[key] = value;
    }
  }
  return config;
}

export default (): TConfig => {
  if (!instance) {
    const baseConfig = JSON.parse(readFileSync(path.join(keysDir, "config.json"), "utf8"));
    instance = extendConfig(defaultConfig, baseConfig);

    if (process.env.CONFIG_FILE) {
      const runtimeConfig = JSON.parse(readFileSync(process.env.CONFIG_FILE, "utf8"));
      instance = extendConfig(instance, runtimeConfig);
    }
  }
  return instance as TConfig;
};
