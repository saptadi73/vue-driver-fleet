<script setup lang="ts">
withDefaults(
  defineProps<{
    lines?: number
  }>(),
  { lines: 1 },
)
</script>

<template>
  <span class="skeleton-stack" aria-hidden="true">
    <span v-for="line in lines" :key="line" class="skeleton-line" />
  </span>
</template>
