<template>
  <TransitionGroup
    name="list"
    tag="div"
    :class="className"
    @before-enter="$emit('beforeEnter')"
    @after-enter="$emit('afterEnter')"
  >
    <slot />
  </TransitionGroup>
</template>

<script setup lang="ts">
defineProps<{
  className?: string;
}>();

defineEmits<{
  beforeEnter: [];
  afterEnter: [];
}>();
</script>

<style scoped>
.list-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-leave-active {
  transition: all 0.2s ease-in;
  position: absolute;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.list-move {
  transition: transform 0.3s ease;
}
</style>
