import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import jestPlugin from "eslint-plugin-jest";

export default [
    {
        ignores: ["coverage/**", "dist/**", "node_modules/**"],
    },
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
            },
            globals: {
                // Common Node.js and Jest globals
                console: "readonly",
                process: "readonly",
                __dirname: "readonly",
                module: "readonly",
                require: "readonly",
                setTimeout: "readonly",
                JSON: "readonly",
                Buffer: "readonly",
                // Jest
                describe: "readonly",
                it: "readonly",
                expect: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
                beforeAll: "readonly",
                afterAll: "readonly",
                jest: "readonly",
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            "jest": jestPlugin,
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],
            "jest/no-disabled-tests": "warn",
            "jest/no-focused-tests": "error",
            "jest/no-identical-title": "error",
            "jest/prefer-to-have-length": "warn",
            "jest/valid-expect": "error",
        },
    },
];
