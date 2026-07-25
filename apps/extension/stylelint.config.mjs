/**
 * Stylelint：独立负责 CSS 与 Vue SFC 中 <style> 的约定（与 Prettier 分工不同）
 * - 标准规则集：stylelint-config-standard
 * - .vue 内样式块需 postcss-html 解析（与 postcss-html 依赖配套）
 */
/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard']
};
