<!--
  思维导图 —— 帮助弹窗（快捷键速查，按分组渲染）。

  文案直接读 constants.SHORTCUT_HINTS，与 useMindShortcuts 的实际绑定同源，
  不存在「文档写了但没实现」或「改了按键忘了改说明」的问题。
  分组顺序也来自 constants.SHORTCUT_GROUPS，与数组书写顺序一致。
-->
<template>
  <AppDialog v-model="visible" title="快捷键与操作说明" width="560px" :show-fullscreen="false">
    <div v-for="group in grouped" :key="group.group" class="mind-help__group">
      <h4 class="mind-help__group-title">{{ group.group }}</h4>
      <ul class="mind-help__list">
        <li v-for="item in group.items" :key="item.keys" class="mind-help__item">
          <kbd class="mind-help__keys">{{ item.keys }}</kbd>
          <span class="mind-help__desc">{{ item.desc }}</span>
        </li>
      </ul>
    </div>

    <div class="mind-help__note">
      <p>
        树是唯一真源，节点坐标由布局算法实时推算：拖动节点只是临时摆放，
        下次增删节点、折叠或切换布局时会重新排布。文本、折叠、备注、分支色与布局会保存，坐标不保存。
      </p>
      <p>
        导入导出走项目统一的缓存目录（不弹系统保存框，成功提示里的路径可点击定位）。
        JSON 可完整往返；Markdown 只交换层级与文本，折叠 / 备注 / 分支色不参与。
        导入一律作为<strong>新文档</strong>载入，不会覆盖当前导图。
      </p>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import AppDialog from '@/components/AppDialog.vue'
import { SHORTCUT_GROUPS, SHORTCUT_HINTS } from '../constants'

const visible = defineModel<boolean>({ default: false })

/** 按 SHORTCUT_GROUPS 的顺序分组；某组没有条目时自然消失（v-for 会产出空数组） */
const grouped = computed(() =>
  SHORTCUT_GROUPS.map(group => ({
    group,
    items: SHORTCUT_HINTS.filter(item => item.group === group),
  })).filter(entry => entry.items.length > 0),
)
</script>

<style scoped lang="scss">
.mind-help__group + .mind-help__group {
  margin-top: 14px;
}

.mind-help__group-title {
  margin: 0 0 6px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.mind-help__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mind-help__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 8px;
  border-radius: 6px;

  &:nth-child(odd) {
    background: var(--bg-hover);
  }
}

.mind-help__keys {
  flex: none;
  min-width: 176px;
  padding: 3px 8px;
  border: 1px solid var(--border-subtle);
  border-bottom-width: 2px;
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
  text-align: center;
}

.mind-help__desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.mind-help__note {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.7;

  p {
    margin: 0;
  }

  p + p {
    margin-top: 6px;
  }

  strong {
    color: var(--text-secondary);
    font-weight: 600;
  }
}
</style>
