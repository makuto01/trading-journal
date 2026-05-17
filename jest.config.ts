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
      "ts-jest",
      {
        tsconfig: {
          paths: { "@/*": ["src/*"] },
        },
      },
    ],
  },
  // Don't try to transform the generated Prisma client during webhook
  // handler tests — we mock the repository surface instead.
  transformIgnorePatterns: ["/node_modules/", "/src/generated/"],
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/app/api/**/*.ts",
    "!src/generated/**",
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 80,
      functions: 80,
      statements: 80,
    },
  },
}

export default config
