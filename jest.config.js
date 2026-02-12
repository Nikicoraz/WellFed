export default {
    testEnvironment: "node",
    roots: [
        "<rootDir>/dist"
    ],
    verbose: true,
    collectCoverage: true,
    collectCoverageFrom: [
        "<rootDir>/dist/src/**/*.js",
        "!<rootDir>/dist/src/models/*",
    ],
    setupFilesAfterEnv: ["./dist/src/__test__/jest.setup.js"]
};