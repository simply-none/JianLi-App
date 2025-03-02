<template>
  <div class="layout-vue">
    <Layout isPadding>
      <template #top>
        <div>
          <Header :title="title" @back="toHome" />
        </div>
      </template>
      <template #left>
        <!-- element-plus 左侧菜单 -->
        <el-menu :default-active="activeIndex" class="left-menu">
          <!-- 结合路由router一起使用 -->
          <el-menu-item @click="toggleRoute(routerItem)" v-for="routerItem in layoutRouters" :index="routerItem.name">
            {{ routerItem.meta?.title || '占位' }}
          </el-menu-item>


        </el-menu>
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
import { ref } from 'vue';
import { useRoute, useRouter, type RouteRecordNameGeneric, type Router, type RouteRecordRaw } from 'vue-router';
import { layoutRouters } from '@/router';


const router = useRouter();
const route = useRoute();
console.log('route', route);
const title = ref(route.meta?.title || '占位');

const activeIndex = ref<RouteRecordNameGeneric>(route.name || 'setting');

const toggleRoute = (item: RouteRecordRaw) => {
  activeIndex.value = item.name;
  console.log('activeIndex', activeIndex.value);

  title.value = item.meta?.title || '占位';
  router.push({
    name: activeIndex.value,
  });
}
const toHome = () => {
  router.push({
    name: 'home',
    query: {
      from: 'setting',
    },
  });
}

</script>

<style scoped lang="scss">
.layout-vue {
  height: 100%;
  width: 100%;

  .left-menu {
    height: 100%;
  }
}
</style>
