/**
 * Ant Design 主题配置
 * 基于 Ant Design 5.0+ Design Token 系统
 * https://ant.design/docs/customize-theme
 */

export const themeConfig = {
  // 算法：亮色/暗色主题
  algorithm: undefined, // 或使用 theme.darkAlgorithm / theme.compactAlgorithm

  // 主题色
  token: {
    // 主色
    colorPrimary: '#1677ff',  // 科技蓝

    // 圆角
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,

    // 字体
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    
    // 颜色
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f5f5f5',
    colorBorder: '#d9d9d9',
    colorBorderSecondary: '#f0f0f0',
    colorText: '#262626',
    colorTextSecondary: '#595959',
    colorTextTertiary: '#8c8c8c',
    colorTextQuaternary: '#bfbfbf',

    // 阴影
    boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08)',
    boxShadowSecondary: '0 6px 16px 0 rgba(0, 0, 0, 0.12)',

    // 控制
    controlHeight: 36,
    controlHeightLG: 40,
    controlHeightSM: 28,

    // 动画
    motionDurationFast: '0.1s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',
  },

  // 组件级别覆盖
  components: {
    Button: {
      primaryShadow: '0 2px 8px rgba(22, 119, 255, 0.35)',
      defaultBorderColor: '#d9d9d9',
      fontWeight: 500,
    },
    Card: {
      paddingLG: 24,
      headerBg: '#fafafa',
    },
    Table: {
      headerBg: '#fafafa',
      headerColor: '#262626',
      rowHoverBg: '#f5f5f5',
      borderColor: '#f0f0f0',
    },
    Input: {
      activeBorderColor: '#1677ff',
      hoverBorderColor: '#40a9ff',
      paddingBlock: 8,
      paddingInline: 12,
    },
    Select: {
      optionSelectedBg: '#e6f4ff',
    },
    Menu: {
      itemSelectedBg: '#e6f4ff',
      itemSelectedColor: '#1677ff',
      itemHoverBg: '#f5f5f5',
    },
  },
};

// 暗色主题配置
export const darkThemeConfig = {
  token: {
    colorPrimary: '#1668dc',
    colorBgContainer: '#1f1f1f',
    colorBgElevated: '#2d2d2d',
    colorBgLayout: '#151515',
    colorBorder: '#434343',
    colorBorderSecondary: '#303030',
    colorText: '#e8e8e8',
    colorTextSecondary: '#b2b2b2',
    colorTextTertiary: '#8c8c8c',
    colorTextQuaternary: '#595959',
    boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.45)',
    boxShadowSecondary: '0 6px 16px 0 rgba(0, 0, 0, 0.6)',
  },
  components: {
    Card: {
      headerBg: '#2d2d2d',
    },
    Table: {
      headerBg: '#2d2d2d',
      rowHoverBg: '#262626',
      borderColor: '#303030',
    },
    Menu: {
      itemSelectedBg: '#111d2c',
      itemHoverBg: '#1f1f1f',
    },
  },
};
