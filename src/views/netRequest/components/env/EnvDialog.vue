<template>
  <el-dialog
    v-model="visible"
    title="环境变量管理"
    width="640px"
    :close-on-click-modal="false"
  >
    <div class="env-dialog">
      <!-- 左：环境列表 -->
      <div class="env-list">
        <div class="list-head">
          <span>环境列表</span>
          <el-button size="small" text type="primary" @click="addEnv">
            <LucideIcon name="Plus" :size="13" />
            新建
          </el-button>
        </div>
        <div
          v-for="env in draftEnvs"
          :key="env.id || env.__key"
          class="env-item"
          :class="{ active: draftActiveId === env.id }"
          @click="selectEnv(env)"
        >
          <el-input
            v-model="env.name"
            size="small"
            class="env-name-input"
            placeholder="环境名（如 dev）"
            @click.stop
          />
          <span class="env-count">{{ env.vars.length }}</span>
          <el-button
            size="small"
            text
            type="danger"
            @click.stop="removeEnv(env)"
          >
            <LucideIcon name="Trash2" :size="13" />
          </el-button>
        </div>
      </div>

      <!-- 右：当前环境变量编辑 -->
      <div class="env-vars">
        <div class="vars-head">
          <span>变量（{{ draftVars.length }}）</span>
          <el-button size="small" text type="primary" @click="addVar">
            <LucideIcon name="Plus" :size="13" />
            添加变量
          </el-button>
        </div>
        <div v-for="(v, i) in draftVars" :key="v.id" class="var-row">
          <el-checkbox
            v-model="v.enabled"
            @change="syncSelectedVars"
          />
          <el-input v-model="v.key" size="small" placeholder="变量名" @change="syncSelectedVars" />
          <el-input v-model="v.value" size="small" placeholder="变量值" @change="syncSelectedVars" />
          <el-button size="small" text type="danger" @click="removeVar(i)">
            <LucideIcon name="X" :size="13" />
          </el-button>
        </div>
        <div v-if="!draftVars.length" class="vars-empty">
          {{ selectedEnv ? '暂无变量，点击「添加变量」' : '请先在左侧选择环境' }}
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveAll">保存全部</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 环境变量管理弹窗：左侧环境列表（增删改名），右侧变量 KV 编辑
 * 编辑基于草稿副本，「保存全部」时统一落库
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { Environment, EnvVar } from '../../types'
import { uid } from '../../composables/useEnvironment'

/** 弹窗可见性（v-model） */
const visible = defineModel<boolean>({ default: false })

/** 保存完成事件（父组件刷新环境列表） */
const emit = defineEmits<{
  (e: 'saved'): void
}>()

/** 组件 props 定义 */
const props = defineProps<{
  /** 环境列表（进入弹窗时复制为草稿） */
  envs: Environment[];
}>()

/** 草稿环境列表（编辑中） */
const draftEnvs = ref<(Environment & { __key: string })[]>([])
/** 当前选中的环境 id */
const draftActiveId = ref(0)
/** 保存中标记 */
const saving = ref(false)

/** 弹窗打开时复制草稿 */
watch(visible, (val) => {
  if (val) {
    draftEnvs.value = props.envs.map((e) => ({
      ...e,
      vars: e.vars.map((v) => ({ ...v })),
      __key: uid(),
    }))
    draftActiveId.value = props.envs.find((e) => e.isActive)?.id || 0
  }
})

/** 当前选中环境的变量列表（引用草稿，可直接改） */
const draftVars = computed<EnvVar[]>(() => {
  const env = draftEnvs.value.find((e) => e.id === draftActiveId.value)
  return env ? env.vars : []
})

/** 当前选中的环境对象 */
const selectedEnv = computed(() =>
  draftEnvs.value.find((e) => e.id === draftActiveId.value)
)

/**
 * 选中环境
 * @param env 环境对象
 */
function selectEnv(env: Environment & { __key: string }): void {
  draftActiveId.value = env.id
}

/**
 * 新建环境（草稿态，负数临时 id，保存时落库换取自增 id）
 */
function addEnv(): void {
  const tempId = -Date.now()
  draftEnvs.value.push({
    id: tempId,
    name: `环境${draftEnvs.value.length + 1}`,
    vars: [],
    isActive: false,
    updatedAt: 0,
    __key: uid(),
  })
  draftActiveId.value = tempId
}

/**
 * 删除环境（草稿态移除；已落库环境在保存时真正删除）
 * @param env 环境对象
 */
function removeEnv(env: Environment & { __key: string }): void {
  draftEnvs.value = draftEnvs.value.filter((e) => e !== env)
  if (draftActiveId.value === env.id) {
    draftActiveId.value = draftEnvs.value[0]?.id || 0
  }
  if (env.id > 0) {
    deletedIds.value.push(env.id)
  }
}

/** 待删除的已落库环境 id 列表 */
const deletedIds = ref<number[]>([])

/**
 * 添加变量到当前选中环境
 */
function addVar(): void {
  if (!selectedEnv.value) {
    ElMessage.warning('请先选择环境')
    return
  }
  selectedEnv.value.vars.push({ id: uid(), key: '', value: '', enabled: true })
}

/**
 * 删除变量
 * @param index 变量下标
 */
function removeVar(index: number): void {
  selectedEnv.value?.vars.splice(index, 1)
}

/**
 * 变量行内编辑后的同步钩子（当前为响应式直改，保留位便于扩展）
 */
function syncSelectedVars(): void {
  /* 响应式对象直接修改即可，无额外同步逻辑 */
}

/**
 * 保存全部：删除标记的环境 → 逐个落库 → 激活原激活环境
 */
async function saveAll(): Promise<void> {
  saving.value = true
  try {
    const { deleteEnv, saveEnv, activateEnv } = await import('../../db')
    // 1. 删除标记环境
    for (const id of deletedIds.value) {
      await deleteEnv(id)
    }
    // 2. 记录草稿态的激活环境（新环境临时负数 id 需按引用匹配）
    const activeDraft = draftEnvs.value.find((e) => e.id === draftActiveId.value)
    // 3. 逐个保存，记录「需要激活」的落库 id
    let activateId = 0
    for (const env of draftEnvs.value) {
      const payload: Environment = {
        id: env.id > 0 ? env.id : 0,
        name: env.name.trim() || '未命名环境',
        vars: env.vars.filter((v) => v.key.trim()),
        isActive: false,
        updatedAt: 0,
      }
      const savedId = await saveEnv(payload)
      if (env === activeDraft) {
        activateId = savedId
      }
    }
    // 4. 激活原激活环境
    if (activateId) {
      await activateEnv(activateId)
    }
    emit('saved')
    visible.value = false
    ElMessage.success('环境已保存')
  } catch (err: any) {
    ElMessage.error('环境保存失败：' + (err?.message || err))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.env-dialog {
  display: flex;
  gap: 12px;
  min-height: 320px;
}

.env-list {
  width: 220px;
  border-right: 1px solid var(--el-border-color-lighter);
  padding-right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
}

.list-head,
.vars-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.env-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.active {
    background: var(--el-color-primary-light-9);
  }
}

.env-name-input {
  flex: 1;
}

.env-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.env-vars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.var-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.vars-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
</style>
