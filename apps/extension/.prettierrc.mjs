/**
 * Prettier 格式化规则（与编辑器「默认格式化」、eslint-plugin-prettier 共用）
 */
export default {
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'none',
  bracketSpacing: true,
  bracketSameLine: true,
  printWidth: 120,
  // Windows 检出为 CRLF 时避免与 eslint-plugin-prettier 无休止冲突；CI 仍可用 core.autocrlf=input 统一 LF
  endOfLine: 'auto',
  // JSX/TSX 标签属性默认仍是双引号，须单独打开才会与 singleQuote 一致
  jsxSingleQuote: true,
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  importOrder: [
    '<BUILTIN_MODULES>', // Node.js built-in modules
    '<THIRD_PARTY_MODULES>', // Imports not matched by other special words or groups.
    '', // Empty line
    '^@plasmo/(.*)$',
    '',
    '^@plasmohq/(.*)$',
    '',
    '^~(.*)$',
    '',
    '^[./]'
  ]
};
