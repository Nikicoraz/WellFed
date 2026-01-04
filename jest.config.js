export default {
    testEnvironment: "node",
    roots: [
        "<rootDir>/dist"
    ],
    verbose: true,
    collectCoverage: true,
    setupFilesAfterEnv: ["./dist/src/__test__/jest.setup.js"]
};