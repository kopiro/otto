module.exports = {
  roots: ["<rootDir>/src"],
  setupFiles: ["dotenv/config"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "js"],
};
