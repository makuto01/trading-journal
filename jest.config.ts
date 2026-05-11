import type { Config } from "jest"

const config: Config = {
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: false, decorators: false },
          target: "es2022",
          baseUrl: ".",
          paths: { "@/*": ["src/*"] },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  // Don't try to transform the generated Prisma client during webhook
  // handler tests — we mock the repository surface instead.
  transformIgnorePatterns: ["/node_modules/", "/src/generated/"],
}

export default config
