module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/tests/integration"],
    testMatch: ["**/*integration.test.ts"],
    setupFiles: ["<rootDir>/tests/setup-env.ts"],
    globalSetup: "<rootDir>/tests/integration/globalSetup.ts",
    globalTeardown: "<rootDir>/tests/integration/globalTeardown.ts",
    maxWorkers: 1,
    forceExit: true,
    transform: {
        "^.+\\.[jt]sx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }]
    },
    transformIgnorePatterns: [
        "/node_modules/(?!(promise-breaker|uuid)/)"
    ]
};
