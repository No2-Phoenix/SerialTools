<template>
  <Transition
    name="modal"
    :appear="appear"
    @before-enter="$emit('beforeEnter')"
    @after-enter="$emit('afterEnter')"
    @before-leave="$emit('beforeLeave')"
    @after-leave="$emit('afterLeave')"
  >
    <slot />
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  appear?: boolean;
}>();

defineEmits<{
  beforeEnter: [];
  afterEnter: [];
  beforeLeave: [];
  afterLeave: [];
}>();
</script>

<style scoped>
.modal-enter-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-leave-active {
  transition: all 0.2s ease-in;
}

.modal-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.modal-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
