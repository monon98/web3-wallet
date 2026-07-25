import { defineConfig, presetWind3 } from 'unocss';

export default defineConfig({
  content: {
    filesystem: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}']
  },
  presets: [presetWind3({ dark: 'class' })]
});
