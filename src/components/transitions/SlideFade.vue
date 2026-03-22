<template>
  <Transition
    name="slide-fade"
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
.slide-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
