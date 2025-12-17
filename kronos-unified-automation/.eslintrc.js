module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "react-app",
    "react-app/jest",
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  plugins: ["@typescript-eslint", "react-hooks"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  },
  settings: {
    react: {
      version: "detect"
    }
  }
}