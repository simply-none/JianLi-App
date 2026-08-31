/**
 * 二维码全局 store（L3 页面 + 跨模块共享）
 * ------------------------------------------------------------------
 * - QR_SOURCE：本页面写入历史时统一使用的来源标识（区分其它业务模块）。
 * - currentStyle：当前选中的视觉样式（持久化到 qr-code:style）。
 * - historyRefreshToken：历史变更信号，历史页据此刷新列表。
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getStore, setStore } from '@/utils/common';
import { QR_STYLE_PRESETS } from '@/utils/qrcode';
import type { QrStyleOptions } from '@/utils/qrcode';

/** 本模块写入 qr_history 时的来源标识 */
export const QR_SOURCE = 'qrCode';

export default defineStore('qr-code', () => {
  // 当前样式：默认取第一套预设
  const currentStyle = ref<QrStyleOptions>({
    ...(QR_STYLE_PRESETS[0]?.style || {}),
  });
  /** 当前套用预设 id（'custom' 表示自定义） */
  const stylePresetId = ref<string>(QR_STYLE_PRESETS[0]?.id || 'classic');

  // 历史刷新信号：写入/删除历史后 +1，历史页 watch 它重新拉取
  const historyRefreshToken = ref(0);

  // 从本地存储恢复样式
  const savedStyle = getStore('qr-code:style');
  if (savedStyle && typeof savedStyle === 'object') {
    currentStyle.value = { ...currentStyle.value, ...savedStyle };
  }

  /** 设置当前样式并持久化 */
  function setStyle(style: QrStyleOptions, presetId: string = 'custom') {
    currentStyle.value = style;
    stylePresetId.value = presetId;
    setStore('qr-code:style', style);
  }

  /** 触发历史刷新 */
  function bumpHistory() {
    historyRefreshToken.value += 1;
  }

  return {
    currentStyle,
    stylePresetId,
    historyRefreshToken,
    setStyle,
    bumpHistory,
  };
});
