import { defineConfig, presetWind3 } from 'unocss';

/**
 * UnoCSS 主配置；扫描路径在 postcss 中声明（与官方 Next 示例一致）。
 * @see https://unocss.dev/integrations/next
 */
export default defineConfig({
  // 与 globals.css 的 prefers-color-scheme 一致；否则 dark: 仅匹配 .dark 祖先，系统暗色下不生效
  presets: [presetWind3({ dark: 'class' })]
});
