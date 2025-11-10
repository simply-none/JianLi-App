<script setup>
defineProps(['name'])
</script>

<template>
  <svg v-if="name === 'save'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M21 7v12q0 .825-.587 1.413T19 21H5q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h12zm-9 11q1.25 0 2.125-.875T15 15t-.875-2.125T12 12t-2.125.875T9 15t.875 2.125T12 18m-6-8h9V6H6z"
    />
  </svg>

  <svg v-else-if="name === 'restore'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="m12 17l4-4l-1.4-1.4l-1.6 1.55V9h-2v4.15L9.4 11.6L8 13zm-6 5q-.825 0-1.412-.587T4 20V8l6-6h8q.825 0 1.413.588T20 4v16q0 .825-.587 1.413T18 22zm0-2h12V4h-7.15L6 8.85zm0 0h12z"
    />
  </svg>

  <svg v-else-if="name === 'list'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path d="M606.1 64H409.6c-24.1 0-43.4 21.4-43.4 47.9 0 26.6 19.3 48.1 43.4 48.1h197.7c22.9 0 42.2-21.5 42.2-48.1-0.1-26.5-19.3-47.9-43.4-47.9z m213.3 32h-97.8c1 5.3 1.6 10.6 1.6 15.9 0 40.4-29.2 80.1-64.1 80.1H358.6c-36.6 0-66-39.7-66-80.1 0-5.4 0.6-10.7 1.6-15.9h-99C115.6 96 96 141.1 96 206.2v644.7c0 70 28 109.1 105.1 109.1h612.2c77.2 0 114.7-30.7 114.7-109V206.2C928 141.1 892.9 96 819.4 96zM718.9 732.6H293.4c-15.7 0-31.3-19.2-31.3-34.9s13.2-29.1 28.9-29.1h424.2c15.7 0 28.9 12.2 30.1 29.1 0 15.6-10.8 34.9-26.4 34.9z m1.7-170.7H295.2c-15.7 0-25.7-16.9-25.7-32.6 0-15.7 13.3-31.4 28.9-31.4h424.2c15.7 0 28.9 14.6 30.1 31.4 0 15.7-16.5 32.6-32.1 32.6z m0-175.4H295.2c-15.7 0-25.7-16.9-25.7-32.6 0-15.7 13.3-31.4 28.9-31.4h424.2c15.7 0 28.9 14.6 30.1 31.4 0 15.8-16.5 32.6-32.1 32.6z" fill="currentColor"></path>
  </svg>

  <svg v-else-if="name === 'add'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path fill="currentColor" d="M11 13H5v-2h6V5h2v6h6v2h-6v6h-2z" />
  </svg>

   <svg v-else-if="name === 'horizontal'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M2,12 L22,12" stroke="currentColor" stroke-width="2" />
    <path d="M7,7 L2,12 L7,17" stroke="currentColor" stroke-width="2" fill="none" />
    <path d="M17,7 L22,12 L17,17" stroke="currentColor" stroke-width="2" fill="none" />
  </svg>

  <svg v-else-if="name === 'vertical'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12,2 L12,22" stroke="currentColor" stroke-width="2" />
    <path d="M7,7 L12,2 L17,7" stroke="currentColor" stroke-width="2" fill="none" />
    <path d="M7,17 L12,22 L17,17" stroke="currentColor" stroke-width="2" fill="none" />
  </svg>
</template>
