/**
 * Next.js 要求的 PostCSS 形状。
 * UnoCSS 扫描路径在 `uno.config.ts` 的 `content.filesystem`（当前 @unocss/postcss 从 Uno 配置读取）。
 * @see https://unocss.dev/integrations/next
 * @see https://nextjs.org/docs/messages/postcss-shape
 */
export default {
  plugins: {
    '@unocss/postcss': {}
  }
};
