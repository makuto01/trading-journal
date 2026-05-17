/** @type {import('jest').Config} */
const config = {
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
  transformIgnorePatterns: ["/node_modules/", "/src/generated/"],
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/app/api/**/*.ts",
    // Exclude generated code and files that require integration testing
    "!src/generated/**",
    "!src/lib/prisma.ts",
    "!src/lib/uploads.ts",
    "!src/lib/utils.ts",
    "!src/app/api/webhook/route.ts",
    "!src/app/api/analytics/route.ts",
    "!src/app/api/trades/export/route.ts",
    "!src/app/api/trades/[id]/images/route.ts",
    "!src/app/api/trades/[id]/images/[imageId]/route.ts",
    "!src/app/api/analyze-image/route.ts",
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

module.exports = config
