module.exports = {
  apps: [
    {
      name: "otto",
      script: "./src/main.js",
      node_args: ["--harmony", "--inspect"],
      instances: 1,
      autorestart: true,
      watch: ["./src"],
      max_memory_restart: "1G"
    }
  ]
};
