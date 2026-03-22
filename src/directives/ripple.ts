import type { Directive, DirectiveBinding } from 'vue';

interface RippleOptions {
  color?: string;
  duration?: number;
}

const createRipple = (event: MouseEvent, el: HTMLElement, options: RippleOptions = {}) => {
  const { color = 'rgba(255, 255, 255, 0.4)', duration = 600 } = options;
  
  // 获取点击位置
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  
  // 创建波纹元素
  const ripple = document.createElement('span');
  ripple.style.cssText = `
    position: absolute;
    border-radius: 50%;
    background: ${color};
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    pointer-events: none;
    transform: scale(0);
    animation: ripple-effect ${duration}ms ease-out;
  `;
  
  // 确保容器有相对定位
  const computedStyle = window.getComputedStyle(el);
  if (computedStyle.position === 'static') {
    el.style.position = 'relative';
  }
  el.style.overflow = 'hidden';
  
  // 添加波纹元素
  el.appendChild(ripple);
  
  // 动画结束后移除
  setTimeout(() => {
    ripple.remove();
  }, duration);
};

// 添加全局样式
const addRippleStyles = () => {
  if (document.getElementById('ripple-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'ripple-styles';
  style.textContent = `
    @keyframes ripple-effect {
      0% {
        transform: scale(0);
        opacity: 0.5;
      }
      100% {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
};

// 添加压感效果
const addPressEffect = (el: HTMLElement) => {
  el.style.transition = 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1)';
  
  el.addEventListener('mousedown', () => {
    el.style.transform = 'scale(0.96)';
  });
  
  el.addEventListener('mouseup', () => {
    el.style.transform = 'scale(1)';
  });
  
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'scale(1)';
  });
  
  // 触摸设备支持
  el.addEventListener('touchstart', () => {
    el.style.transform = 'scale(0.96)';
  });
  
  el.addEventListener('touchend', () => {
    el.style.transform = 'scale(1)';
  });
};

export const vRipple: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<RippleOptions | undefined>) {
    addRippleStyles();
    
    const options = binding.value || {};
    
    el.addEventListener('click', (e) => createRipple(e, el, options));
    
    // 如果绑定了 press 修饰符，添加压感效果
    if (binding.modifiers.press) {
      addPressEffect(el);
    }
  },
  
  unmounted() {
    // 清理工作由浏览器自动处理
  },
};

export default vRipple;
