<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  title: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function close() {
  emit('update:modelValue', false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.modelValue) close()
}

watch(
  () => props.modelValue,
  (open) => {
    document.body.classList.toggle('modal-open', open)
  },
  { immediate: true },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('modal-open')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-backdrop" @click.self="close">
        <section class="modal-panel" role="dialog" aria-modal="true" :aria-label="title">
          <header class="modal-header">
            <h2>{{ title }}</h2>
            <button class="modal-close" type="button" aria-label="Tutup dialog" @click="close">
              ×
            </button>
          </header>
          <div class="modal-content">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
