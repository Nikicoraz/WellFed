export default {
    testEnvironment: "node",
    roots: [
        "<rootDir>/dist"
    ],
    verbose: true,
    collectCoverage: true,
    setupFilesAfterEnv: ["./dist/src/test/jest.setup.js"]
};