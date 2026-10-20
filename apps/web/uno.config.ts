import { defineConfig, presetWind3 } from 'unocss';

/**
 * UnoCSS 主配置。
 * 扫描路径必须放在 `content.filesystem`：当前 `@unocss/postcss` 从 Uno 配置读取，
 * postcss 插件选项里的 `content` 不会生效（会导致 `@plugin/ui` 组件样式缺失）。
 * @see https://unocss.dev/integrations/next
 */
export default defineConfig({
  content: {
    filesystem: [
      './src/**/*.{html,js,ts,jsx,tsx}',
      '../../packages/ui/src/**/*.{ts,tsx}'
    ]
  },
  // dark: 变体依赖 .dark 祖先，与 globals.css 中的 .dark 主题 token 配套
  presets: [presetWind3({ dark: 'class' })]
});
