<!--
  小纸条主页面（薄壳，P1-6）。
  定位：PC ⇄ 手机 的文字 / 链接速传（≤8000 字），大文件请走「文件互传」。
  结构：说明条 → 发送区 → 记录列表（收 / 发）。
  状态与动作全部在 useNoteSlip store；子组件为纯展示原子组件。
-->
<template>
  <div class="note-slip-page">
    <div class="note-slip-page__status">
      <LucideIcon name="StickyNotePlus" :size="16" />
      <span>
        在同一局域网内，把文字 / 链接一键甩到手机（或反向）。单条上限 8000 字，传文件请用「文件互传」。
      </span>
    </div>

    <section class="note-slip-page__card">
      <div class="note-slip-page__card-head">
        <span>发送</span>
        <span v-if="store.lastPeerIp" class="note-slip-page__last">
          最近：{{ store.lastPeerIp }}
        </span>
      </div>
      <SlipCompose />
    </section>

    <section class="note-slip-page__card">
      <div class="note-slip-page__card-head">
        <span>
          记录
          <em v-if="store.unreadCount" class="note-slip-page__unread">
            {{ store.unreadCount }} 条未读
          </em>
        </span>
        <div class="note-slip-page__head-actions">
          <el-button size="small" text :loading="store.loading" @click="store.loadList()">
            刷新
          </el-button>
          <el-button size="small" text :disabled="!store.items.length" @click="onClear">
            清空
          </el-button>
        </div>
      </div>
      <SlipList
        :items="store.items"
        @read="store.markRead($event)"
        @remove="store.remove($event)"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox, ElMessage } from "element-plus";
import { onMounted, onUnmounted } from "vue";

import { useNoteSlip } from "@/store/useNoteSlip";
import SlipCompose from "./components/SlipCompose.vue";
import SlipList from "./components/SlipList.vue";

const store = useNoteSlip();

async function onClear() {
  try {
    await ElMessageBox.confirm("确定清空本机全部小纸条记录？", "清空记录", {
      type: "warning",
      confirmButtonText: "清空",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  await store.clear();
  ElMessage.success("已清空");
}

onMounted(() => {
  store.loadAll();
  store.scan();
  store.bindEvents();
});

onUnmounted(() => {
  store.unbindEvents();
});
</script>

<style scoped lang="scss">
.note-slip-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 14px 16px;
  overflow: auto;

  &__status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.6;
    background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  }

  &__card {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  }

  &__card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 600;
  }

  &__last {
    font-weight: 400;
    font-size: 11px;
    opacity: 0.55;
  }

  &__unread {
    margin-left: 6px;
    font-style: normal;
    font-weight: 400;
    font-size: 11px;
    color: var(--el-color-primary);
  }

  &__head-actions {
    display: flex;
    gap: 4px;
  }
}
</style>
