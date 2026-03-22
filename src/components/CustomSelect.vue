<template>
  <div class="custom-select" :class="{ open: isOpen, disabled: disabled }">
    <div class="select-trigger" @click="toggle" ref="triggerRef">
      <span class="selected-value" :class="{ placeholder: !hasValue }">
        {{ displayValue }}
      </span>
      <span class="select-arrow" :class="{ rotated: isOpen }">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </div>
    
    <teleport to="body">
      <transition name="dropdown-fade">
        <div 
          v-if="isOpen" 
          class="select-dropdown"
          :style="dropdownStyle"
          ref="dropdownRef"
          @click.stop
        >
          <div class="dropdown-content">
            <div 
              v-for="option in options" 
              :key="option.value"
              class="select-option"
              :class="{ 
                active: modelValue === option.value,
                focused: focusedIndex === getIndex(option.value),
                disabled: option.disabled
              }"
              @click="select(option.value)"
              @mouseenter="focusedIndex = getIndex(option.value)"
            >
              <span class="option-label">{{ option.label }}</span>
              <span v-if="option.description" class="option-desc">{{ option.description }}</span>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  modelValue: {},
  options: {
    type: Array,
    required: true,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '请选择...'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  position: {
    type: String,
    default: 'bottom'
  }
})

const emit = defineEmits(['update:modelValue', 'change', 'open', 'close'])

const isOpen = ref(false)
const focusedIndex = ref(-1)
const triggerRef = ref(null)
const dropdownRef = ref(null)

const hasValue = computed(() => {
  return props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== ''
})

const displayValue = computed(() => {
  if (!hasValue.value) return props.placeholder
  const option = props.options.find(opt => opt.value === props.modelValue)
  return option ? option.label : props.placeholder
})

const dropdownStyle = ref({})

const updateDropdownPosition = () => {
  if (!triggerRef.value || !dropdownRef.value) return
  
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  const dropdownWidth = Math.max(200, triggerRect.width)
  dropdownRef.value.style.width = `${dropdownWidth}px`
  
  let left = triggerRect.left
  if (left + dropdownWidth > viewportWidth - 10) {
    left = viewportWidth - dropdownWidth - 10
  }
  left = Math.max(10, left)
  
  let top
  if (props.position === 'top') {
    top = triggerRect.top - 10
  } else {
    top = triggerRect.bottom + 10
    const dropdownHeight = dropdownRef.value.offsetHeight
    if (top + dropdownHeight > viewportHeight - 10) {
      top = triggerRect.top - dropdownHeight - 10
    }
  }
  
  dropdownStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 9999
  }
}

const toggle = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      updateDropdownPosition()
      const index = props.options.findIndex(opt => opt.value === props.modelValue)
      focusedIndex.value = index >= 0 ? index : 0
    })
    emit('open')
  } else {
    emit('close')
  }
}

const close = () => {
  isOpen.value = false
  emit('close')
}

const select = (value) => {
  emit('update:modelValue', value)
  emit('change', value)
  close()
}

const getIndex = (value) => {
  return props.options.findIndex(opt => opt.value === value)
}

const handleKeydown = (e) => {
  if (!isOpen.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
    return
  }
  
  switch (e.key) {
    case 'Escape':
      close()
      break
    case 'ArrowDown':
      e.preventDefault()
      focusedIndex.value = Math.min(focusedIndex.value + 1, props.options.length - 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (focusedIndex.value >= 0 && focusedIndex.value < props.options.length) {
        select(props.options[focusedIndex.value].value)
      }
      break
  }
}

const handleClickOutside = (e) => {
  if (isOpen.value && triggerRef.value && !triggerRef.value.contains(e.target)) {
    close()
  }
}

watch(() => isOpen.value, (newValue) => {
  if (newValue) {
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('scroll', updateDropdownPosition, true)
    window.addEventListener('resize', updateDropdownPosition)
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('scroll', updateDropdownPosition, true)
    window.removeEventListener('resize', updateDropdownPosition)
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('scroll', updateDropdownPosition, true)
  window.removeEventListener('resize', updateDropdownPosition)
})

defineExpose({
  toggle,
  close,
  isOpen
})
</script>

<style scoped>
.custom-select {
  position: relative;
  width: 100%;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-elevated, #252d3d);
  border: 1px solid var(--border-default, rgba(255,255,255,0.08));
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  pointer-events: auto;
  z-index: 1;
}

.select-trigger:hover {
  background: var(--bg-tertiary, #1e2433);
  border-color: var(--border-hover, rgba(255,255,255,var(--card-hover-border-opacity, 0.15)));
  transform: translateY(-2px);
}

.select-trigger:active {
  transform: scale(0.98);
}

.selected-value {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary, #e0e0e0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-value.placeholder {
  color: var(--text-secondary, rgba(255,255,255,0.5));
}

.select-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, rgba(255,255,255,0.6));
  transition: transform 0.3s ease;
}

.select-arrow.rotated {
  transform: rotate(180deg);
}

.select-dropdown {
  position: fixed;
  background: var(--bg-elevated, #252d3d);
  border: 1px solid var(--border-default, rgba(255,255,255,0.1));
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
              0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
  backdrop-filter: blur(10px);
  z-index: 9999;
  pointer-events: auto;
}

.dropdown-content {
  max-height: 240px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px;
}

.dropdown-content::-webkit-scrollbar {
  width: 6px;
}

.dropdown-content::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-content::-webkit-scrollbar-thumb {
  background: var(--border-default, rgba(255,255,255,0.1));
  border-radius: 3px;
}

.dropdown-content::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover, rgba(255,255,255,0.2));
}

.select-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  margin: 2px 0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.select-option:hover {
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--border-hover, rgba(255,255,255,var(--card-hover-border-opacity, 0.15)));
  padding: 9px 11px;
}

.select-option.focused {
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.1));
  border: 1px solid var(--border-hover, rgba(255,255,255,var(--card-hover-border-opacity, 0.15)));
  padding: 9px 11px;
}

.select-option.active {
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.12));
  border: 1px solid var(--primary-color, rgba(6, 182, 212, var(--card-hover-border-opacity, 0.25)));
  padding: 9px 11px;
}

.select-option.active:hover {
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.15));
  border: 1px solid var(--primary-color, rgba(6, 182, 212, var(--card-hover-border-opacity, 0.25)));
  padding: 9px 11px;
}

.select-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
  background: transparent;
  border: none;
  padding: 10px 12px;
}

.option-label {
  font-size: 13px;
  color: var(--text-primary, #e0e0e0);
  font-weight: 500;
}

.option-desc {
  font-size: 11px;
  color: var(--text-secondary, rgba(255,255,255,0.4));
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.custom-select.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.custom-select.disabled .select-trigger {
  cursor: not-allowed;
}
</style>
