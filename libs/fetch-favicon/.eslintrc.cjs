module.exports = {
  extends: ['@patricktree/eslint-config/eslint-ecma.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
  },
  rules: {
    /* allow for this package to use console logs, as it is typically used in CLI applications */
    'no-console': 'off',
  },
};
