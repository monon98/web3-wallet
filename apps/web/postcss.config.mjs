/**
 * Next.js 要求的 PostCSS 形状 + UnoCSS 官方推荐写法。
 * @see https://unocss.dev/integrations/next
 * @see https://nextjs.org/docs/messages/postcss-shape
 */
export default {
  plugins: {
    '@unocss/postcss': {
      content: [
        './src/**/*.{html,js,ts,jsx,tsx}',
        '../../packages/ui/src/**/*.{ts,tsx}'
      ]
    }
  }
};
