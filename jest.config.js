export default {
    testEnvironment: "node",
    roots: [
        "<rootDir>/dist"
    ],
    setupFilesAfterEnv: ["./dist/src/test/jest.setup.js"]
};