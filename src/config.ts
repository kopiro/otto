import path from "path";
import defaultConfig from "./default-config.json";
import { readFileSync } from "fs";
import { keysDir } from "./paths";

let _instance: typeof defaultConfig = null;

function extendConfig(config, localConfig, path = "") {
  for (const [key, value] of Object.entries(localConfig)) {
    if (typeof value === "object" && !Array.isArray(value)) {
      if (key in config) {
        extendConfig(config[key], localConfig[key], `${path}.${key}`);
      } else {
        throw new Error(`Invalid key ${path}.${key} in config`);
      }
    } else {
      config[key] = value;
    }
  }
  return config;
}

export default () => {
  if (!_instance) {
    const baseConfig = JSON.parse(readFileSync(path.join(keysDir, "config.json"), "utf8"));
    _instance = extendConfig(defaultConfig, baseConfig);

    if (process.env.CONFIG_FILE) {
      const runtimeConfig = JSON.parse(readFileSync(process.env.CONFIG_FILE, "utf8"));
      _instance = extendConfig(_instance, runtimeConfig);
    }
  }
  return _instance;
};
