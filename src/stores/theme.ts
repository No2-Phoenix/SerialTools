import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';

export type ThemeType = 'dark' | 'light' | 'sakura' | 'arctic' | 'lavender';

interface ThemeConfig {
  name: ThemeType;
  label: string;
  icon: string;
}

export const themes: Record<ThemeType, ThemeConfig> = {
  dark: {
    name: 'dark',
    label: '深色专业',
    icon: 'Moon',
  },
  light: {
    name: 'light',
    label: '浅色清爽',
    icon: 'Sun',
  },
  sakura: {
    name: 'sakura',
    label: '樱花粉',
    icon: 'Flower2',
  },
  arctic: {
    name: 'arctic',
    label: '克莱因蓝',
    icon: 'Droplets',
  },
  lavender: {
    name: 'lavender',
    label: '梦幻紫',
    icon: 'Sparkles',
  },
};

export const useThemeStore = defineStore('theme', () => {
  const storedTheme = localStorage.getItem('greenserial-theme') as ThemeType;
  const currentTheme = ref<ThemeType>(storedTheme || 'dark');

  const themeConfig = computed(() => themes[currentTheme.value]);
  const themeLabel = computed(() => themeConfig.value.label);
  const isDark = computed(() => currentTheme.value === 'dark');

  const setTheme = (theme: ThemeType) => {
    currentTheme.value = theme;
    localStorage.setItem('greenserial-theme', theme);
    updateDocumentTheme();
  };

  const toggleTheme = () => {
    const themeList: ThemeType[] = ['dark', 'light', 'sakura', 'arctic', 'lavender'];
    const currentIndex = themeList.indexOf(currentTheme.value);
    const nextIndex = (currentIndex + 1) % themeList.length;
    setTheme(themeList[nextIndex]);
  };

  const updateDocumentTheme = () => {
    document.documentElement.setAttribute('data-theme', currentTheme.value);
    // 同时更新 naive-ui 的主题
    updateNaiveTheme();
  };

  const updateNaiveTheme = () => {
    const root = document.documentElement;
    
    // 获取 CSS 变量值
    const getVar = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
    
    // 设置 naive-ui 的 CSS 变量覆盖
    root.style.setProperty('--n-primary-color', getVar('--primary-color'));
    root.style.setProperty('--n-primary-color-hover', getVar('--primary-light'));
    root.style.setProperty('--n-primary-color-pressed', getVar('--primary-dark'));
    root.style.setProperty('--n-primary-color-suppl', getVar('--primary-light'));
    
    root.style.setProperty('--n-text-color-base', getVar('--text-primary'));
    root.style.setProperty('--n-text-color-1', getVar('--text-primary'));
    root.style.setProperty('--n-text-color-2', getVar('--text-secondary'));
    root.style.setProperty('--n-text-color-3', getVar('--text-tertiary'));
    
    root.style.setProperty('--n-body-color', getVar('--bg-primary'));
    root.style.setProperty('--n-card-color', getVar('--bg-secondary'));
    root.style.setProperty('--n-modal-color', getVar('--bg-elevated'));
    root.style.setProperty('--n-popover-color', getVar('--bg-elevated'));
    
    root.style.setProperty('--n-border-color', getVar('--border-default'));
    root.style.setProperty('--n-divider-color', getVar('--border-subtle'));
    
    root.style.setProperty('--n-success-color', getVar('--success-color'));
    root.style.setProperty('--n-warning-color', getVar('--warning-color'));
    root.style.setProperty('--n-error-color', getVar('--error-color'));
    root.style.setProperty('--n-info-color', getVar('--info-color'));
  };

  // 初始化主题
  const initTheme = () => {
    updateDocumentTheme();
    // 延迟执行以确保 CSS 变量已加载
    setTimeout(updateNaiveTheme, 100);
  };

  // 监听主题变化
  watch(currentTheme, () => {
    updateNaiveTheme();
  });

  // Naive UI themeOverrides 配置
  const naiveThemeOverrides = computed(() => {
    const getVar = (name: string) => `var(${name})`;
    
    return {
      common: {
        primaryColor: getVar('--primary-color'),
        primaryColorHover: getVar('--primary-light'),
        primaryColorPressed: getVar('--primary-dark'),
        primaryColorSuppl: getVar('--primary-light'),
        
        textColorBase: getVar('--text-primary'),
        textColor1: getVar('--text-primary'),
        textColor2: getVar('--text-secondary'),
        textColor3: getVar('--text-tertiary'),
        
        bodyColor: getVar('--bg-primary'),
        cardColor: getVar('--bg-secondary'),
        modalColor: getVar('--bg-elevated'),
        popoverColor: getVar('--bg-elevated'),
        
        borderColor: getVar('--border-default'),
        dividerColor: getVar('--border-subtle'),
        
        successColor: getVar('--success-color'),
        warningColor: getVar('--warning-color'),
        errorColor: getVar('--error-color'),
        infoColor: getVar('--info-color'),
        
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontFamilyMono: "'JetBrains Mono', 'Fira Code', monospace",
        
        borderRadius: '8px',
        borderRadiusSmall: '6px',
      },
      Button: {
        textColor: getVar('--text-primary'),
        textColorHover: getVar('--primary-color'),
        textColorPressed: getVar('--primary-dark'),
        textColorFocus: getVar('--primary-color'),
        textColorDisabled: getVar('--text-muted'),
        
        color: getVar('--bg-secondary'),
        colorHover: getVar('--bg-tertiary'),
        colorPressed: getVar('--bg-elevated'),
        colorFocus: getVar('--bg-tertiary'),
        colorDisabled: getVar('--bg-secondary'),
        
        border: `1px solid ${getVar('--border-default')}`,
        borderHover: `1px solid ${getVar('--border-hover')}`,
        borderPressed: `1px solid ${getVar('--border-focus')}`,
        borderFocus: `1px solid ${getVar('--border-focus')}`,
        borderDisabled: `1px solid ${getVar('--border-subtle')}`,
        
        colorPrimary: getVar('--primary-color'),
        colorHoverPrimary: getVar('--primary-light'),
        colorPressedPrimary: getVar('--primary-dark'),
        colorFocusPrimary: getVar('--primary-light'),
        colorDisabledPrimary: getVar('--primary-dark'),
        
        textColorPrimary: '#ffffff',
        textColorHoverPrimary: '#ffffff',
        textColorPressedPrimary: '#ffffff',
        textColorFocusPrimary: '#ffffff',
        textColorDisabledPrimary: 'rgba(255, 255, 255, 0.6)',
        
        borderPrimary: 'none',
        borderHoverPrimary: 'none',
        borderPressedPrimary: 'none',
        borderFocusPrimary: `2px solid ${getVar('--border-focus')}`,
        borderDisabledPrimary: 'none',
        
        colorGhost: 'transparent',
        colorHoverGhost: getVar('--bg-tertiary'),
        colorPressedGhost: getVar('--bg-elevated'),
        colorFocusGhost: getVar('--bg-tertiary'),
        colorDisabledGhost: 'transparent',
        
        textColorGhost: getVar('--text-secondary'),
        textColorHoverGhost: getVar('--text-primary'),
        textColorPressedGhost: getVar('--text-primary'),
        textColorFocusGhost: getVar('--text-primary'),
        textColorDisabledGhost: getVar('--text-muted'),
        
        borderGhost: `1px solid ${getVar('--border-default')}`,
        borderHoverGhost: `1px solid ${getVar('--border-hover')}`,
        borderPressedGhost: `1px solid ${getVar('--border-focus')}`,
        borderFocusGhost: `1px solid ${getVar('--border-focus')}`,
        borderDisabledGhost: `1px solid ${getVar('--border-subtle')}`,
      },
      Input: {
        color: getVar('--bg-secondary'),
        colorFocus: getVar('--bg-secondary'),
        colorDisabled: getVar('--bg-tertiary'),
        colorError: getVar('--bg-secondary'),
        
        textColor: getVar('--text-primary'),
        textColorDisabled: getVar('--text-muted'),
        
        placeholderColor: getVar('--text-tertiary'),
        placeholderColorDisabled: getVar('--text-muted'),
        
        border: `1px solid ${getVar('--border-default')}`,
        borderHover: `1px solid ${getVar('--border-hover')}`,
        borderFocus: `1px solid ${getVar('--primary-color')}`,
        borderError: `1px solid ${getVar('--error-color')}`,
        borderDisabled: `1px solid ${getVar('--border-subtle')}`,
        
        boxShadowFocus: `0 0 0 2px ${getVar('--primary-glow')}`,
        boxShadowError: `0 0 0 2px rgba(239, 68, 68, 0.2)`,
      },
      Select: {
        color: getVar('--bg-secondary'),
        colorActive: getVar('--bg-tertiary'),
        colorDisabled: getVar('--bg-tertiary'),
        
        textColor: getVar('--text-primary'),
        textColorDisabled: getVar('--text-muted'),
        
        placeholderColor: getVar('--text-tertiary'),
        
        border: `1px solid ${getVar('--border-default')}`,
        borderHover: `1px solid ${getVar('--border-hover')}`,
        borderActive: `1px solid ${getVar('--primary-color')}`,
        borderDisabled: `1px solid ${getVar('--border-subtle')}`,
        
        boxShadowActive: `0 0 0 2px ${getVar('--primary-glow')}`,
        
        menuColor: getVar('--bg-elevated'),
      },
      Card: {
        color: getVar('--bg-secondary'),
        colorModal: getVar('--bg-elevated'),
        colorPopover: getVar('--bg-elevated'),
        colorEmbedded: getVar('--bg-tertiary'),
        colorTarget: getVar('--primary-glow'),
        
        textColor: getVar('--text-primary'),
        textColorSecondary: getVar('--text-secondary'),
        
        borderColor: getVar('--border-default'),
        borderRadius: '12px',
        
        boxShadow: getVar('--shadow-sm'),
        boxShadowModal: getVar('--shadow-lg'),
        boxShadowPopover: getVar('--shadow-md'),
      },
      Modal: {
        color: getVar('--bg-elevated'),
        textColor: getVar('--text-primary'),
        boxShadow: getVar('--shadow-lg'),
      },
      Drawer: {
        color: getVar('--bg-secondary'),
        textColor: getVar('--text-primary'),
      },
      Menu: {
        color: getVar('--bg-secondary'),
        colorHover: getVar('--bg-tertiary'),
        colorActive: getVar('--primary-glow'),
        colorActiveHover: getVar('--primary-glow'),
        
        textColor: getVar('--text-secondary'),
        textColorHover: getVar('--text-primary'),
        textColorActive: getVar('--primary-color'),
        textColorActiveHover: getVar('--primary-light'),
        textColorChildActive: getVar('--primary-color'),
        textColorChildActiveHover: getVar('--primary-light'),
        
        borderColorHorizontal: getVar('--border-subtle'),
      },
      Tabs: {
        colorSegment: getVar('--bg-tertiary'),
        tabColorSegment: getVar('--bg-secondary'),
        tabColorSegmentActive: getVar('--bg-elevated'),
        
        tabTextColorSegment: getVar('--text-secondary'),
        tabTextColorSegmentActive: getVar('--text-primary'),
        
        borderColor: getVar('--border-default'),
      },
      Tag: {
        color: getVar('--bg-tertiary'),
        colorBordered: 'transparent',
        
        textColor: getVar('--text-secondary'),
        textColorBordered: getVar('--text-secondary'),
        
        border: `1px solid ${getVar('--border-default')}`,
        borderBordered: `1px solid ${getVar('--border-default')}`,
        
        colorPrimary: getVar('--primary-color'),
        textColorPrimary: '#ffffff',
        borderPrimary: 'none',
        
        colorSuccess: getVar('--success-color'),
        textColorSuccess: '#ffffff',
        borderSuccess: 'none',
        
        colorWarning: getVar('--warning-color'),
        textColorWarning: '#ffffff',
        borderWarning: 'none',
        
        colorError: getVar('--error-color'),
        textColorError: '#ffffff',
        borderError: 'none',
        
        colorInfo: getVar('--info-color'),
        textColorInfo: '#ffffff',
        borderInfo: 'none',
      },
      Tooltip: {
        color: getVar('--bg-elevated'),
        textColor: getVar('--text-primary'),
        boxShadow: getVar('--shadow-md'),
      },
      Dropdown: {
        color: getVar('--bg-elevated'),
        textColor: getVar('--text-primary'),
        boxShadow: getVar('--shadow-md'),
      },
      Switch: {
        color: getVar('--bg-tertiary'),
        colorActive: getVar('--primary-color'),
      },
      Checkbox: {
        color: getVar('--bg-secondary'),
        colorChecked: getVar('--primary-color'),
        colorDisabled: getVar('--bg-tertiary'),
        colorDisabledChecked: getVar('--primary-dark'),
        
        border: `1px solid ${getVar('--border-default')}`,
        borderChecked: `1px solid ${getVar('--primary-color')}`,
        borderDisabled: `1px solid ${getVar('--border-subtle')}`,
        borderDisabledChecked: `1px solid ${getVar('--primary-dark')}`,
        
        boxShadowFocus: `0 0 0 2px ${getVar('--primary-glow')}`,
      },
      Radio: {
        color: getVar('--bg-secondary'),
        colorActive: getVar('--primary-color'),
        colorDisabled: getVar('--bg-tertiary'),
        colorDisabledActive: getVar('--primary-dark'),
        
        boxShadow: `inset 0 0 0 1px ${getVar('--border-default')}`,
        boxShadowActive: `inset 0 0 0 5px ${getVar('--primary-color')}`,
        boxShadowDisabled: `inset 0 0 0 1px ${getVar('--border-subtle')}`,
        boxShadowDisabledActive: `inset 0 0 0 5px ${getVar('--primary-dark')}`,
        
        boxShadowFocus: `0 0 0 2px ${getVar('--primary-glow')}`,
      },
      Slider: {
        fillColor: getVar('--primary-color'),
        fillColorHover: getVar('--primary-light'),
        
        indicatorColor: getVar('--bg-elevated'),
        indicatorTextColor: getVar('--text-primary'),
        indicatorBoxShadow: getVar('--shadow-md'),
        
        handleColor: '#ffffff',
        handleColorHover: '#ffffff',
        handleColorActive: '#ffffff',
        handleColorDisabled: getVar('--text-muted'),
        
        railColor: getVar('--bg-tertiary'),
        railColorHover: getVar('--border-hover'),
        railColorActive: getVar('--bg-tertiary'),
        railColorDisabled: getVar('--bg-secondary'),
        
        dotColor: getVar('--border-default'),
        dotColorActive: getVar('--primary-color'),
      },
      Progress: {
        fillColor: getVar('--primary-color'),
        fillColorSuccess: getVar('--success-color'),
        fillColorWarning: getVar('--warning-color'),
        fillColorError: getVar('--error-color'),
        
        railColor: getVar('--bg-tertiary'),
        railHeight: '6px',
      },
      Spin: {
        color: getVar('--primary-color'),
      },
      Skeleton: {
        color: getVar('--bg-tertiary'),
        colorEnd: getVar('--bg-secondary'),
      },
      Divider: {
        color: getVar('--border-subtle'),
        textColor: getVar('--text-tertiary'),
      },
      Empty: {
        textColor: getVar('--text-tertiary'),
        iconColor: getVar('--text-muted'),
        iconSizeMedium: '64px',
        iconSizeLarge: '80px',
        fontSizeMedium: '14px',
        fontSizeLarge: '16px',
      },
      Badge: {
        color: getVar('--error-color'),
        textColor: '#ffffff',
      },
      Popover: {
        color: getVar('--bg-elevated'),
        textColor: getVar('--text-primary'),
        boxShadow: getVar('--shadow-md'),
      },
      Popselect: {
        menuColor: getVar('--bg-elevated'),
      },
      Tree: {
        color: getVar('--bg-secondary'),
        colorHover: getVar('--bg-tertiary'),
        colorActive: getVar('--primary-glow'),
        colorDisabled: getVar('--bg-secondary'),
        
        textColor: getVar('--text-secondary'),
        textColorHover: getVar('--text-primary'),
        textColorActive: getVar('--primary-color'),
        textColorDisabled: getVar('--text-muted'),
      },
      Transfer: {
        listColor: getVar('--bg-secondary'),
        listColorHover: getVar('--bg-tertiary'),
        listColorActive: getVar('--primary-glow'),
      },
      ColorPicker: {
        panelColor: getVar('--bg-elevated'),
      },
      DatePicker: {
        panelColor: getVar('--bg-elevated'),
        panelTextColor: getVar('--text-primary'),
        itemTextColor: getVar('--text-secondary'),
        itemTextColorActive: '#ffffff',
        itemColorActive: getVar('--primary-color'),
        itemColorHover: getVar('--bg-tertiary'),
        arrowColor: getVar('--text-secondary'),
      },
      TimePicker: {
        panelColor: getVar('--bg-elevated'),
        panelTextColor: getVar('--text-primary'),
        itemTextColor: getVar('--text-secondary'),
        itemTextColorActive: '#ffffff',
        itemColorActive: getVar('--primary-color'),
        itemColorHover: getVar('--bg-tertiary'),
      },
      Mention: {
        menuColor: getVar('--bg-elevated'),
      },
      AutoComplete: {
        menuColor: getVar('--bg-elevated'),
      },
      Cascader: {
        menuColor: getVar('--bg-elevated'),
      },
      InternalSelectMenu: {
        color: getVar('--bg-elevated'),
        optionColorPending: getVar('--bg-tertiary'),
        optionColorActive: getVar('--primary-glow'),
        optionTextColor: getVar('--text-secondary'),
        optionTextColorPending: getVar('--text-primary'),
        optionTextColorActive: getVar('--primary-color'),
        optionCheckColor: getVar('--primary-color'),
      },
      InternalSelection: {
        color: getVar('--bg-secondary'),
        colorActive: getVar('--bg-tertiary'),
        colorDisabled: getVar('--bg-tertiary'),
        
        textColor: getVar('--text-primary'),
        textColorDisabled: getVar('--text-muted'),
        
        placeholderColor: getVar('--text-tertiary'),
        
        border: `1px solid ${getVar('--border-default')}`,
        borderActive: `1px solid ${getVar('--primary-color')}`,
        borderDisabled: `1px solid ${getVar('--border-subtle')}`,
        
        boxShadowActive: `0 0 0 2px ${getVar('--primary-glow')}`,
      },
    };
  });

  return {
    currentTheme,
    themeConfig,
    themeLabel,
    isDark,
    themes,
    setTheme,
    toggleTheme,
    initTheme,
    naiveThemeOverrides,
  };
});
