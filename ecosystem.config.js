module.exports = {
  apps: [
    {
      name: "otto",
      script: "./src/boot.ts",
      node_args: ["--inspect", "-r", "ts-node/register"],
      instances: 1,
      autorestart: true,
      watch: ["./src"],
      max_memory_restart: "1G"
    }
  ]
};
