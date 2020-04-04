import defaultConfig from "./default-config.json";
import fs from "fs";

let config: typeof defaultConfig = null;

function parseLocalConfig(config, localConfig, path = "") {
  for (const [key, value] of Object.entries(localConfig)) {
    if (typeof value === "object" && !Array.isArray(value)) {
      if (key in config) {
        parseLocalConfig(config[key], localConfig[key], `${path}.${key}`);
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
  if (config) return config;

  if (process.env.CONFIG_FILE) {
    config = parseLocalConfig(defaultConfig, JSON.parse(fs.readFileSync(process.env.CONFIG_FILE, "utf8")));
  } else {
    config = defaultConfig;
  }

  return config;
};
