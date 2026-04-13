const sharedRules = {
  "no-constant-binary-expression": "error",
  "no-dupe-keys": "error",
  "no-sparse-arrays": "error",
  "no-unreachable": "error",
  "no-unused-private-class-members": "error",
  "use-isnan": "error",
  "valid-typeof": "error"
};

const browserGlobals = {
  AbortController: "readonly",
  Blob: "readonly",
  BroadcastChannel: "readonly",
  CustomEvent: "readonly",
  DOMParser: "readonly",
  Event: "readonly",
  EventSource: "readonly",
  File: "readonly",
  FileReader: "readonly",
  FormData: "readonly",
  Headers: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  alert: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  crypto: "readonly",
  document: "readonly",
  fetch: "readonly",
  globalThis: "readonly",
  history: "readonly",
  localStorage: "readonly",
  location: "readonly",
  navigator: "readonly",
  performance: "readonly",
  queueMicrotask: "readonly",
  requestAnimationFrame: "readonly",
  sessionStorage: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  structuredClone: "readonly",
  window: "readonly"
};

const nodeGlobals = {
  Buffer: "readonly",
  URL: "readonly",
  console: "readonly",
  globalThis: "readonly",
  process: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly"
};

export default [
  {
    ignores: [
      ".appdata/**",
      ".deps/**",
      ".dotnet/**",
      ".local/**",
      ".nuget/**",
      ".vendor_manual/**",
      ".vendor_py/**",
      ".wheelhouse/**",
      "_worktrees/**",
      "data/**",
      "node_modules/**",
      "tools/**",
      "tmp*/**",
      "workbench/**"
    ]
  },
  {
    files: ["app.js", "player-profile.js", "recommendation-contract.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: browserGlobals
    },
    rules: sharedRules
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals
    },
    rules: sharedRules
  }
];
