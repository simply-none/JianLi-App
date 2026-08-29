/**
 * 内置浏览器 - 网页夜间模式（模块级单例 composable）
 * ------------------------------------------------------------------
 * 原理：向页面注入覆盖样式（CSS filter 反色 + 色相旋转，图片/视频二次反色还原），
 * 实现「网页颜色背景根据主题变化」的暗化效果。
 * 三种模式：
 * - off   关闭；
 * - on    始终开启；
 * - auto  跟随应用主题：当前主题为暗色系时自动开启（暗色主题清单见 DARK_THEMES）。
 * 生效范围：所有已挂载 webview；页面每次导航完成后由 WebViewPane 重新注入。
 * 状态持久化：browser-night-mode（getStore/setStore 通道）。
 */
import { computed, ref, watch } from "vue";
import useTheme, { type ThemeName } from "@/store/useTheme";
import useBrowser from "@/store/useBrowser";
import { getStore, setStore } from "@/utils/common";
import { getWebview } from "./useWebviewBridge";

/** 夜间模式类型 */
export type NightMode = "off" | "on" | "auto";

/** 暗色系主题清单（浅色：light / catppuccin / atom-one-light） */
export const DARK_THEMES: ThemeName[] = [
  "dark",
  "midnight",
  "nord",
  "one-dark",
  "dracula",
  "github-dark",
  "tokyo-night",
  "solarized",
  "gruvbox",
  "catppuccin-mocha",
  "ayu-dark",
  "ayu-mirage",
  "monokai",
  "synthwave",
  "material-dark",
  "jellybeans",
  "tomorrow-night",
  "cobalt",
  "spacemacs",
  "tender",
  "brackets-dark",
  "glass",
];

/** 夜间模式状态（模块级单例） */
const mode = ref<NightMode>("auto");

/** 初始化标记（避免重复订阅主题变化） */
let inited = false;

/**
 * 当前夜间模式实际是否生效
 * - auto：当前应用主题为暗色系时生效
 */
const nightOn = computed(() => {
  if (mode.value === "on") return true;
  if (mode.value === "off") return false;
  // pinia setup store 返回的 ref 在实例上已解包
  const theme = useTheme().currentTheme;
  return DARK_THEMES.includes(theme);
});

/**
 * 注入/移除夜间模式样式的页面脚本
 * @param on 必填，是否开启夜间模式
 * @returns 可在 webview.executeJavaScript 中执行的脚本
 */
function buildScript(on: boolean): string {
  const css =
    "html{filter:invert(1) hue-rotate(180deg);background:#fff !important}" +
    "img,video,picture,iframe,svg,canvas{filter:invert(1) hue-rotate(180deg)}";
  if (on) {
    return `(function(){var id='__app_night_mode_style';var el=document.getElementById(id);` +
      `if(!el){el=document.createElement('style');el.id=id;el.textContent=${JSON.stringify(css)};` +
      `(document.head||document.documentElement).appendChild(el);}})();`;
  }
  return `(function(){var el=document.getElementById('__app_night_mode_style');if(el&&el.parentNode){el.parentNode.removeChild(el);}})();`;
}

/**
 * 对指定标签应用当前夜间模式状态
 * @param tabId 必填，标签 ID
 */
export function applyNightMode(tabId: string) {
  const wv = getWebview(tabId);
  if (!wv) return;
  try {
    wv.executeJavaScript(buildScript(nightOn.value)).catch(() => {});
  } catch {
    // webview 尚未就绪时忽略
  }
}

/**
 * 对全部已挂载的标签应用夜间模式
 */
export function applyNightModeAll() {
  const store = useBrowser();
  store.tabs.forEach((t) => applyNightMode(t.id));
}

/**
 * 切换夜间模式并立即全量生效
 * @param next 必填，目标模式
 */
export function setNightMode(next: NightMode) {
  mode.value = next;
  setStore("browser-night-mode", next);
  applyNightModeAll();
}

/**
 * 循环切换模式：off -> auto -> on -> off
 * @returns 切换后的模式
 */
export function cycleNightMode(): NightMode {
  const order: NightMode[] = ["off", "auto", "on"];
  const next = order[(order.indexOf(mode.value) + 1) % order.length];
  setNightMode(next);
  return next;
}

/**
 * 初始化：读取持久化状态 + 主题变化时自动刷新全部标签
 * （在浏览器页面 setup 中调用一次）
 */
export function useNightMode() {
  const themeStore = useTheme();
  if (!inited) {
    inited = true;
    const stored = getStore("browser-night-mode") as NightMode | undefined;
    if (stored === "on" || stored === "off" || stored === "auto") {
      mode.value = stored;
    }
    // 跟随主题：主题切换时刷新所有已挂载标签
    watch(
      () => themeStore.currentTheme,
      () => applyNightModeAll()
    );
  }
  return { mode, nightOn };
}
