import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import { routes } from './router';

// 导入样式系统
import './styles/theme.css';
import './styles/design-system.css';
import './styles/themes.css';
import './styles/animations.css';
import './styles/responsive.css';

// 导入指令
import { vRipple } from './directives/ripple';

const app = createApp(App);
const pinia = createPinia();
const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 注册全局指令
app.directive('ripple', vRipple);

app.use(pinia);
app.use(router);

app.mount('#app');
