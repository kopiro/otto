module.exports = {
  apps: [
    {
      name: "otto",
      script: "./src/main.js",
      node_args: "--harmony",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G"
    }
  ]
};
