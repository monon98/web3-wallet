export default {
  // 环境：浏览器 + ES6
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  // 继承规则（ESLint + Prettier）
  extends: [
    'eslint:recommended',
    //   "plugin:vue/vue3-essential", // Vue3 项目用这个
    // "plugin:vue/essential", // Vue2 项目用这个
    // "plugin:react/recommended", // React 项目打开
    'plugin:prettier/recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  // 自定义规则（可自行修改）
  rules: {
    'no-console': 'warn', // console 仅警告
    'prettier/prettier': 'error' // 格式错误标红
  }
};
