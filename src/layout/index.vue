<template>
  <div class="layout-vue">
    <Layout isPadding>
      <template #top>
        <div>
          <Header :title="title" @back="toHome" />
        </div>
      </template>
      <template #left>
        <nav class="sidebar-menu">
          <div v-for="group in menuGroups" :key="group.label" class="menu-group">
            <div class="group-label">{{ group.label }}</div>
            <div
              v-for="item in group.items"
              :key="item.name as string"
              class="menu-item"
              :class="{ 'is-active': activeIndex === item.name }"
              @click="toggleRoute(item)"
            >
              <el-icon :size="17" class="menu-icon"><component :is="item.meta?.icon" /></el-icon>
              <span class="menu-text">{{ item.meta?.title || '占位' }}</span>
            </div>
          </div>
        </nav>
      </template>
      <template #main>
        <RouterView />
      </template>
    </Layout>
  </div>
</template>

<script setup lang="ts">
import Layout from '@/components/layout.vue';
import Header from '@/components/header.vue';
import { ref, computed } from 'vue';
import { useRoute, useRouter, type RouteRecordNameGeneric, type RouteRecordRaw } from 'vue-router';
import { layoutRouters } from '@/router';
import { storeToRefs } from 'pinia';
import useRuntimeVariables from '@/store/useRuntimeVariables';
import { watch } from 'vue';
import {
  Setting, Monitor, House, Grid, Timer,
  FolderOpened, Connection, Files, Document,
  Notebook, Opportunity, Lock, MagicStick,
  Position, Coin, Share, Tools, InfoFilled,
} from '@element-plus/icons-vue';

// 路由名称 → 图标映射
const iconMap: Record<string, any> = {
  setting: Setting,
  systemInfo: Monitor,
  homeMode: House,
  windowMode: Grid,
  pomodoroRecord: Timer,
  appCache: FolderOpened,
  fileRela: Connection,
  resourceManage: Files,
  clipboard: Document,
  notebook: Notebook,
  registerShortcut: Opportunity,
  safetyProtection: Lock,
  styleBeauty: MagicStick,
  netRequest: Position,
  sqlTest: Coin,
  flow: Share,
  function: Tools,
  about: InfoFilled,
};

// 为每个路由注入图标到 meta
const enrichedRouters = layoutRouters.map(r => ({
  ...r,
  meta: { ...r.meta, icon: iconMap[r.name as string] || Setting },
}));

// 菜单分组定义
interface MenuGroup {
  label: string;
  names: string[];
}

const groupDefs: MenuGroup[] = [
  { label: '通用', names: ['setting', 'homeMode', 'windowMode', 'styleBeauty'] },
  { label: '系统与资源', names: ['systemInfo', 'appCache', 'fileRela', 'resourceManage', 'safetyProtection'] },
  { label: '效率工具', names: ['pomodoroRecord', 'clipboard', 'notebook', 'registerShortcut', 'function'] },
  { label: '开发工具', names: ['netRequest', 'sqlTest', 'flow'] },
  { label: '关于', names: ['about'] },
];

const menuGroups = computed(() => {
  return groupDefs.map(g => ({
    label: g.label,
    items: g.names
      .map(name => enrichedRouters.find(r => r.name === name))
      .filter(Boolean) as RouteRecordRaw[],
  }));
});

const router = useRouter();
const route = useRoute();
const title = ref(route.meta?.title || '占位');

const { activeRouteName } = storeToRefs(useRuntimeVariables());
const { updateActiveRouteName } = useRuntimeVariables();

router.beforeEach((to, from, next) => {
  activeIndex.value = to.name || 'setting';
  next();
});

const activeIndex = ref<RouteRecordNameGeneric>(route.name || 'setting');

watch(activeRouteName, (newVal: string) => {
  if (!newVal || newVal == activeIndex.value) {
    return;
  }
  const cur = layoutRouters.find(item => item.name == newVal);
  if (cur) {
    activeIndex.value = cur.name;
    title.value = cur.meta?.title || '占位';
  }
}, {
  immediate: true,
  deep: true,
});

const toggleRoute = (item: RouteRecordRaw) => {
  activeIndex.value = item.name;
  title.value = item.meta?.title || '占位';
  router.push({ name: activeIndex.value });
};

const toHome = () => {
  router.push({ name: 'home', query: { from: 'setting' } });
};
</script>

<style scoped lang="scss">
.layout-vue {
  height: 100%;
  width: 100%;
}

/* ========== 侧边栏菜单 ========== */
.sidebar-menu {
  height: 100%;
  overflow-y: auto;
  padding: 8px 6px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6px;

  // 滚动条
  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 3px;
  }
  &:hover::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.12);
  }
}

.menu-group {
  display: flex;
  flex-direction: column;
  gap: 1px;

  // 非首组顶部加细线分隔
  & + & {
    padding-top: 6px;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
  }
}

.group-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 6px 12px 4px;
  user-select: none;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.18s, color 0.18s;
  user-select: none;
  color: #4b5563;
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.3;

  .menu-icon {
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity 0.18s, color 0.18s;
  }

  .menu-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* hover 态 */
  &:hover {
    background: rgba(0, 0, 0, 0.04);
    color: #1f2937;

    .menu-icon { opacity: 1; }
  }

  /* active 态 — 柔和紫色高亮 */
  &.is-active {
    background: rgba(99, 102, 241, 0.09);
    color: #4f46e5;
    font-weight: 600;

    .menu-icon {
      color: #6366f1;
      opacity: 1;
    }
  }

  /* active + hover */
  &.is-active:hover {
    background: rgba(99, 102, 241, 0.13);
  }
}
</style>
