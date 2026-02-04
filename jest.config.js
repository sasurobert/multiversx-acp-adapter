/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    },
    transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)',
    ],
    testPathIgnorePatterns: ["/node_modules/", "/dist/"],
    collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts"],
    coverageDirectory: "coverage",
};
