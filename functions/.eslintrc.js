module.exports = {
    root: true,
    env: {
        es6: true,
        node: true,
    },
    parserOptions: {
        ecmaVersion: 2020,
    },
    extends: ['eslint:recommended'],
    rules: {
        indent: ['error', 4],
        'max-len': ['error', {code: 100}],
        quotes: ['error', 'single'],
        'object-curly-spacing': ['error', 'never'],
        'no-unused-vars': ['error', {args: 'none'}],
    },
    overrides: [
        {
            files: ['**/*.spec.*'],
            env: {
                mocha: true,
            },
            rules: {},
        },
    ],
    globals: {},
};
