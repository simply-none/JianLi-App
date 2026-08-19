<template>
  <!-- 小窗模式示例：直接复用主页面组件，仅通过 compact 收紧布局 -->
  <ThemeConversationPage :compact="true" />
</template>

<script setup lang="ts">
import ThemeConversationPage from '../themeConversation/components/ThemeConversationPage.vue';
</script>
