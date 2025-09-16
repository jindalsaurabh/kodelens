// jest.config.ts
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",

  // Only match .ts tests
  testMatch: ["**/__tests__/**/*.test.ts"],

  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },

  moduleFileExtensions: ["ts", "tsx", "js", "json"],

  // Ignore compiled/dist outputs
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/", "/out/"],

  // Optional: suppress noisy diagnostics
  globals: {
    "ts-jest": {
      diagnostics: false,
    },
  },
};

export default config;
