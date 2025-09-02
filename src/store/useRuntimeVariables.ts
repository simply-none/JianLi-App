import { computed, onMounted, ref, toRaw, watchEffect } from "vue";
import type { Ref } from "vue";
import { defineStore, storeToRefs } from "pinia";

export const prefix = 'curStatusInfo'

export type StatusMode = "work" | "rest" | "screen";

export default defineStore("runtime-variables", () => {
  
  // 当前激活的路由name
  const activeRouteName = ref('')

  // 更新当前激活的路由name
  const updateActiveRouteName = (name: string) => {
    activeRouteName.value = name
  }

  return {
    // 变量
    activeRouteName,
    // 方法
    updateActiveRouteName,
  };
});
