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
        <!-- 主题切换器 -->
        <div class="theme-switcher">
          <div class="theme-label">主题</div>
          <div class="theme-options">
            <button
              v-for="t in themeOptions"
              :key="t.name"
              class="theme-dot"
              :class="{ 'is-active': currentTheme === t.name }"
              :title="t.label"
              :style="{ '--dot-bg': t.preview[0], '--dot-card': t.preview[1], '--dot-primary': t.preview[2] }"
              @click="setTheme(t.name)"
            >
              <span class="dot-inner" />
            </button>
          </div>
        </div>
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
import useTheme, { themeOptions } from '@/store/useTheme';
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

// 主题切换
const themeStore = useTheme();
const { currentTheme } = storeToRefs(themeStore);
const { setTheme } = themeStore;
</script>

<style scoped lang="scss">
.layout-vue {
  height: 100%;
  width: 100%;
}

/* ========== 侧边栏菜单 ========== */
.sidebar-menu {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 4px;

  // 滚动条
  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 3px;
  }
  &:hover::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
  }
}

.menu-group {
  display: flex;
  flex-direction: column;
  gap: 2px;

  // 非首组顶部加细线分隔
  & + & {
    padding-top: 8px;
    margin-top: 4px;
    border-top: 1px solid var(--border-group);
  }
}

.group-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 4px 12px 6px;
  user-select: none;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  user-select: none;
  color: var(--text-secondary);
  font-size: 0.86rem;
  font-weight: 500;
  line-height: 1.3;
  position: relative;

  .menu-icon {
    flex-shrink: 0;
    opacity: 0.65;
    transition: opacity 0.2s, color 0.2s;
  }

  .menu-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* hover 态 */
  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);

    .menu-icon { opacity: 0.9; }
  }

  /* active 态 */
  &.is-active {
    background: var(--color-primary-light);
    color: var(--color-primary-solid);
    font-weight: 600;

    // 左侧指示条
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 18px;
      border-radius: 0 3px 3px 0;
      background: var(--color-primary);
      transition: height 0.2s;
    }

    .menu-icon {
      color: var(--color-primary);
      opacity: 1;
    }
  }

  /* active + hover */
  &.is-active:hover {
    background: var(--color-primary-hover);
  }
}

/* ========== 主题切换器 ========== */
.theme-switcher {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid var(--border-subtle);
  user-select: none;
}

.theme-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.03em;
}

.theme-options {
  display: flex;
  gap: 6px;
}

.theme-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--dot-bg);
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;

  .dot-inner {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: block;
    background: linear-gradient(135deg, var(--dot-card) 50%, var(--dot-primary) 50%);
    transition: transform 0.15s;
  }

  &:hover {
    transform: scale(1.15);
    border-color: var(--dot-primary);
  }

  &.is-active {
    border-color: var(--dot-primary);
    box-shadow: 0 0 0 2px var(--dot-primary);

    .dot-inner {
      transform: scale(1.1);
    }
  }
}
</style>
