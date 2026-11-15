module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/tests/unit"],
    testMatch: ["**/*.test.ts"],
    setupFiles: ["<rootDir>/tests/setup-env.ts"],
    transform: {
        "^.+\\.[jt]sx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }]
    },
    transformIgnorePatterns: [
        "/node_modules/(?!(promise-breaker|uuid)/)"
    ]
};
