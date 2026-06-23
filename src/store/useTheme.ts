import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { getStore, setStore } from '@/utils/common';

export type ThemeName = 
  | 'light' 
  | 'dark' 
  | 'midnight' 
  | 'nord' 
  | 'one-dark' 
  | 'dracula' 
  | 'github-dark' 
  | 'tokyo-night' 
  | 'solarized' 
  | 'gruvbox'
  | 'catppuccin'
  | 'catppuccin-mocha'
  | 'ayu-dark'
  | 'ayu-mirage'
  | 'monokai'
  | 'synthwave'
  | 'material-dark'
  | 'jellybeans'
  | 'tomorrow-night'
  | 'atom-one-light'
  | 'cobalt'
  | 'spacemacs'
  | 'tender'
  | 'brackets-dark';

export interface ThemeOption {
  name: ThemeName;
  label: string;
  /** 用于 UI 展示的色块预览 [背景色, 卡片色, 主色调] */
  preview: [string, string, string];
}

export const themeOptions: ThemeOption[] = [
  { name: 'light',            label: '浅色',       preview: ['#f5f6fa', '#ffffff', '#6366f1'] },
  { name: 'dark',             label: '深色',       preview: ['#1a1b26', '#24283b', '#7aa2f7'] },
  { name: 'midnight',         label: '午夜',       preview: ['#1c2128', '#22272e', '#539bf5'] },
  { name: 'nord',             label: '北极',       preview: ['#2e3440', '#3b4252', '#88c0d0'] },
  { name: 'one-dark',         label: 'One Dark',   preview: ['#282c34', '#3e4451', '#e06c75'] },
  { name: 'dracula',          label: 'Dracula',    preview: ['#282a36', '#44475a', '#ff79c6'] },
  { name: 'github-dark',      label: 'GitHub',     preview: ['#161b22', '#21262d', '#58a6ff'] },
  { name: 'tokyo-night',      label: '东京夜',     preview: ['#1a1b26', '#24283b', '#7aa2f7'] },
  { name: 'solarized',        label: 'Solarized',  preview: ['#073642', '#002b36', '#2aa198'] },
  { name: 'gruvbox',          label: 'Gruvbox',    preview: ['#282828', '#3c3836', '#fb4934'] },
  { name: 'catppuccin',       label: 'Catppuccin', preview: ['#f5f5f4', '#e7e5e4', '#c084fc'] },
  { name: 'catppuccin-mocha', label: 'Catppuccin Mocha', preview: ['#1e1e2e', '#313244', '#cba6f7'] },
  { name: 'ayu-dark',         label: 'Ayu Dark',   preview: ['#0a0e14', '#10151b', '#f07178'] },
  { name: 'ayu-mirage',       label: 'Ayu Mirage', preview: ['#171b24', '#1f2430', '#f28779'] },
  { name: 'monokai',          label: 'Monokai',    preview: ['#272822', '#383830', '#f92672'] },
  { name: 'synthwave',        label: 'Synthwave',  preview: ['#1a0033', '#2d005a', '#ff6ec7'] },
  { name: 'material-dark',    label: 'Material',   preview: ['#121212', '#1e1e1e', '#6200ee'] },
  { name: 'jellybeans',       label: 'Jellybeans', preview: ['#1a1a1a', '#242424', '#d0d0ff'] },
  { name: 'tomorrow-night',   label: 'Tomorrow',   preview: ['#1d1d1d', '#282828', '#42a5f5'] },
  { name: 'atom-one-light',   label: 'Atom Light', preview: ['#fafafa', '#ffffff', '#61afef'] },
  { name: 'cobalt',           label: 'Cobalt',     preview: ['#193549', '#224b67', '#ff6600'] },
  { name: 'spacemacs',        label: 'Spacemacs',  preview: ['#282828', '#383838', '#859900'] },
  { name: 'tender',           label: 'Tender',     preview: ['#282828', '#323232', '#f4bf75'] },
  { name: 'brackets-dark',    label: 'Brackets',   preview: ['#111111', '#222222', '#00a8ff'] },
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
