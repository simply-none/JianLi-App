import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { getStore, setStore } from '@/utils/common';

export type ThemeName = 'light' | 'dark' | 'midnight' | 'nord';

export interface ThemeOption {
  name: ThemeName;
  label: string;
  /** 用于 UI 展示的色块预览 [背景色, 卡片色, 主色调] */
  preview: [string, string, string];
}

export const themeOptions: ThemeOption[] = [
  { name: 'light',    label: '浅色',   preview: ['#f5f6fa', '#ffffff', '#6366f1'] },
  { name: 'dark',     label: '深色',   preview: ['#1a1b26', '#24283b', '#7aa2f7'] },
  { name: 'midnight', label: '午夜',   preview: ['#1c2128', '#22272e', '#539bf5'] },
  { name: 'nord',     label: '北极',   preview: ['#2e3440', '#3b4252', '#88c0d0'] },
];

const STORE_KEY = 'appTheme';

export default defineStore('theme', () => {
  const stored = getStore(STORE_KEY) as ThemeName | undefined;
  const currentTheme = ref<ThemeName>(
    stored && themeOptions.some(t => t.name === stored) ? stored : 'light'
  );

  const currentOption = computed(() =>
    themeOptions.find(t => t.name === currentTheme.value) || themeOptions[0]
  );

  function setTheme(name: ThemeName) {
    currentTheme.value = name;
    setStore(STORE_KEY, name);
  }

  return {
    currentTheme,
    currentOption,
    setTheme,
  };
});
