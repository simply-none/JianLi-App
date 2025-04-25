<template>
  <div class="json-editor">
    <JsonEditorVue v-model="json" />
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, watch } from 'vue'
import JsonEditorVue from 'json-editor-vue'

const props = defineProps({
  value: { type: Object, default: ({}) },
})

const emit = defineEmits(['update'])

const json = ref({})

watch(() => props.value, (n) => {
  json.value = JSON.parse(JSON.stringify(n));
}, {
  immediate: true,
  deep: true,
})

watch(() => json.value, (n) => {
  emit('update', n); 
})

</script>