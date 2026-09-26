<script setup lang="ts">
/**
 * 新建表弹窗（对齐设计稿 3:224）：560px / radius 16 / 步骤指示（表名→字段→确认）
 * + 底色输入（无边框）+ 主键徽标 + 蓝描边添加字段 + 底部提示 + 取消/创建。
 * 业务表约定 key(TEXT) 主键；CREATE/ALTER/DROP 不会触发 execute 的自动补列逻辑，安全。
 */
import { ref, watch } from "vue";
import { X, Plus, Trash2 } from "@lucide/vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "created", tableName: string): void;
}>();

interface FieldRow {
  name: string;
  type: string;
  pk: boolean;
}

const tableName = ref("");
const fields = ref<FieldRow[]>([]);

const TYPES = ["TEXT", "INTEGER", "REAL", "NUMERIC", "BLOB"];

watch(
  () => props.open,
  (open) => {
    if (open) {
      tableName.value = "";
      fields.value = [
        { name: "key", type: "TEXT", pk: true },
        { name: "", type: "TEXT", pk: false },
      ];
    }
  }
);

const error = ref("");
const creating = ref(false);

async function create() {
  error.value = "";
  const name = tableName.value.trim();
  if (!name) {
    error.value = "请填写表名";
    return;
  }
  const valid = fields.value.filter((f) => f.name.trim());
  if (valid.length === 0) {
    error.value = "至少需要一个字段";
    return;
  }
  if (valid.filter((f) => f.pk).length > 1) {
    error.value = "主键字段只能有一个";
    return;
  }
  const pk = valid.find((f) => f.pk);
  const colDefs = valid.map((f) => {
    const def = `"${f.name.trim().replace(/"/g, '""')}" ${f.type}`;
    return f.pk ? `${def} PRIMARY KEY` : def;
  });
  const sql = `CREATE TABLE IF NOT EXISTS "${name.replace(/"/g, '""')}" (${colDefs.join(", ")})`;

  creating.value = true;
  const res = await window.ipcRenderer.handlePromise("new-sql:execute", { sql });
  creating.value = false;
  if (!res.success) {
    error.value = res.error || "创建失败";
    return;
  }
  emit("created", name);
  emit("close");
}

function addField() {
  fields.value.push({ name: "", type: "TEXT", pk: false });
}

function removeField(i: number) {
  fields.value.splice(i, 1);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="ctd-mask" @click.self="emit('close')">
      <div class="ctd-dialog">
        <div class="ctd-header">
          <span class="ctd-title">新建表</span>
          <button class="close-btn" @click="emit('close')"><X class="close-icon" /></button>
        </div>

        <!-- 步骤指示（设计稿 3:230） -->
        <div class="steps">
          <div class="step">
            <span class="step-dot on">1</span>
            <span class="step-text on">表名</span>
          </div>
          <span class="step-arrow">→</span>
          <div class="step">
            <span class="step-dot">2</span>
            <span class="step-text">字段</span>
          </div>
          <span class="step-arrow">→</span>
          <div class="step">
            <span class="step-dot">3</span>
            <span class="step-text">确认</span>
          </div>
        </div>

        <div class="ctd-body">
          <label class="dlabel">表名</label>
          <input v-model="tableName" class="tint-input lg" placeholder="例如：客户信息" @keyup.enter="create" />

          <label class="dlabel">字段</label>
          <div v-for="(f, i) in fields" :key="i" class="field-row">
            <input v-model="f.name" class="tint-input f-name" placeholder="字段名" :disabled="f.pk" />
            <select v-model="f.type" class="tint-input f-type">
              <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
            <button class="pk-tag" :class="{ on: f.pk }" :disabled="f.pk && false" @click="f.pk = !f.pk">主键</button>
            <button class="mini-del" @click="removeField(i)"><Trash2 class="del-icon" /></button>
          </div>

          <button class="add-field" @click="addField"><Plus class="add-icon" />添加字段</button>

          <div v-if="error" class="ctd-error">{{ error }}</div>
        </div>

        <div class="ctd-footer">
          <span class="hint">创建后会出现在左侧表列表中</span>
          <div class="foot-btns">
            <button class="cancel-btn" @click="emit('close')">取消</button>
            <button class="pb md" :disabled="creating" @click="create">{{ creating ? "创建中…" : "创建表" }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.ctd-mask {
  position: fixed;
  inset: 0;
  z-index: 1800;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  background: rgba(0, 0, 0, 0.45);
}

/* 设计稿 3:225：560px / radius 16 / padding 24 / gap 18 */
.ctd-dialog {
  width: 560px;
  max-width: calc(100vw - 48px);
  max-height: 74vh;
  overflow-y: auto;
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.2);
}

.ctd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ctd-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: var(--bg-hover);
  cursor: pointer;
}

.close-icon {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

/* 步骤指示：22px 圆点，激活蓝底白字，箭头浅灰 */
.steps {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step {
  display: flex;
  align-items: center;
  gap: 6px;
}

.step-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-muted);

  &.on {
    border: none;
    background: var(--color-primary);
    color: #fff;
    font-weight: 700;
  }
}

.step-text {
  font-size: 13px;
  color: var(--text-muted);

  &.on {
    color: var(--color-primary);
    font-weight: 700;
  }
}

.step-arrow {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 2px;
}

.ctd-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dlabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* 底色输入（设计稿：#F4F5F7 无边框） */
.tint-input {
  height: 36px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: var(--bg-base);
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  box-sizing: border-box;

  &::placeholder {
    color: var(--text-muted);
  }

  &:focus {
    box-shadow: 0 0 0 1.5px var(--color-primary);
  }

  &:disabled {
    color: var(--text-secondary);
  }

  &.lg {
    height: 40px;
    padding: 0 12px;
    font-size: 14px;
  }
}

select.tint-input {
  cursor: pointer;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.f-name {
  flex: 1;
  min-width: 0;
}

.f-type {
  flex: 0 0 100px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* 主键徽标：激活蓝底浅蓝 / 未激活白底描边 */
.pk-tag {
  flex-shrink: 0;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-card);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;

  &.on {
    border: none;
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-weight: 600;
  }
}

.mini-del {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--color-error);
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: var(--tag-bg-danger);
  }
}

.del-icon {
  width: 14px;
  height: 14px;
}

/* 添加字段：蓝描边 40px 通栏 */
.add-field {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;

  &:hover {
    background: var(--color-primary-light);
  }
}

.add-icon {
  width: 14px;
  height: 14px;
}

.ctd-error {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--tag-bg-danger);
  color: var(--color-error);
  font-size: 12px;
}

.ctd-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
}

.foot-btns {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cancel-btn {
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}
</style>
