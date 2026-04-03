# LingoFlow UI/UX 重新设计方案

> 参考 Easydict 的简洁优雅风格，打造专业的 macOS 翻译工具界面

---

## 🎨 设计系统

### 配色方案

| 角色 | 颜色 | 用途 |
|------|------|------|
| Primary | `#3B82F6` | 主要操作按钮、选中状态 |
| Secondary | `#60A5FA` | 次要元素、hover 状态 |
| CTA | `#F97316` | 重要操作（翻译按钮） |
| Background | `#F8FAFC` | 主背景色 |
| Text | `#1E293B` | 主文本颜色 |
| Text Muted | `#475569` | 次要文本 |
| Border | `#E2E8F0` | 边框颜色 |
| Success | `#10B981` | 成功状态 |
| Error | `#EF4444` | 错误状态 |

### 字体系统

**字体家族**：Inter（Google Fonts）

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**字体大小**：
- 标题 H1: 24px / font-weight: 600
- 标题 H2: 20px / font-weight: 600
- 标题 H3: 16px / font-weight: 500
- 正文: 14px / font-weight: 400
- 小字: 12px / font-weight: 400

**行高**：
- 标题: 1.3
- 正文: 1.6

### 间距系统

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;
--spacing-2xl: 32px;
```

### 圆角系统

```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-full: 9999px;
```

### 阴影系统

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

---

## 📱 界面 1：设置界面重新设计

### 当前问题
- 标签页样式较为简单
- 缺少视觉层次感
- 表单元素间距不够统一
- 缺少 hover 和 focus 状态反馈

### 新设计方案

#### 布局结构
```
┌─────────────────────────────────────┐
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐           │  ← 标签页导航
│  │工具│ │快捷│ │服务│ │高级│           │
│  └───┘ └───┘ └───┘ └───┘           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 设置项分组标题               │   │
│  ├─────────────────────────────┤   │
│  │ □ 选项 1                    │   │
│  │ □ 选项 2                    │   │
│  │ ▼ 下拉选择                  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 另一个分组                   │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

#### 标签页设计

**视觉样式**：
- 未选中：`background: transparent`, `color: #64748B`
- 选中：`background: #3B82F6`, `color: white`, `border-radius: 8px`
- Hover：`background: #F1F5F9`, `color: #1E293B`
- 过渡：`transition: all 150ms ease-out`

**图标**：
- 使用 Heroicons 或 Lucide Icons
- 尺寸：20x20px
- 与文字垂直居中对齐

**间距**：
- 标签页之间：8px
- 图标与文字：6px
- 内边距：12px 16px

#### 表单元素设计

**输入框**：
```css
.input {
  padding: 10px 12px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 150ms ease-out;
}

.input:hover {
  border-color: #CBD5E1;
}

.input:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

**复选框**：
- 使用自定义样式，圆角 4px
- 选中状态：蓝色背景 + 白色勾选图标
- 尺寸：18x18px

**下拉选择**：
- 与输入框样式一致
- 下拉箭头图标：Heroicons chevron-down
- 下拉菜单：白色背景 + 阴影

**按钮**：
```css
.button-primary {
  background: #3B82F6;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 150ms ease-out;
}

.button-primary:hover {
  background: #2563EB;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.button-primary:active {
  transform: translateY(0);
}
```

#### 设置分组卡片

```css
.settings-group {
  background: white;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.settings-group-title {
  font-size: 16px;
  font-weight: 600;
  color: #1E293B;
  margin-bottom: 16px;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #F1F5F9;
}

.settings-item:last-child {
  border-bottom: none;
}
```

---

## 🔄 界面 2：翻译界面重新设计

### 当前问题
- 翻译结果卡片样式较为简单
- 缺少加载状态动画
- 错误提示不够明显
- 缺少服务商图标和颜色标识

### 新设计方案

#### 布局结构
```
┌─────────────────────────────────────┐
│  中文 ⇄ English                     │  ← 语言切换栏
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔵 百度翻译                  │   │  ← 翻译结果卡片
│  │ ─────────────────────────   │   │
│  │ Translation result here...  │   │
│  │                      [复制] │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔴 Google 翻译               │   │
│  │ ─────────────────────────   │   │
│  │ Translation result here...  │   │
│  │                      [复制] │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

#### 语言切换栏

```css
.language-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: white;
  border-bottom: 1px solid #E2E8F0;
}

.language-label {
  font-size: 16px;
  font-weight: 500;
  color: #1E293B;
  padding: 8px 16px;
}

.swap-button {
  background: #F1F5F9;
  border-radius: 8px;
  padding: 8px;
  margin: 0 12px;
  cursor: pointer;
  transition: all 150ms ease-out;
}

.swap-button:hover {
  background: #E2E8F0;
  transform: rotate(180deg);
}
```

#### 翻译结果卡片

**基础样式**：
```css
.translation-card {
  background: white;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 200ms ease-out;
  border-left: 3px solid var(--provider-color);
}

.translation-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
```

**服务商标识**：
```css
.provider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.provider-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #1E293B;
}

.provider-icon {
  width: 20px;
  height: 20px;
  font-size: 16px;
}
```

**翻译内容**：
```css
.translation-content {
  font-size: 14px;
  line-height: 1.6;
  color: #1E293B;
  white-space: pre-wrap;
  word-break: break-word;
}
```

**复制按钮**：
```css
.copy-button {
  background: transparent;
  color: #64748B;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  transition: all 150ms ease-out;
  cursor: pointer;
}

.copy-button:hover {
  background: #F1F5F9;
  color: #3B82F6;
}
```

#### 加载状态

```css
.loading-card {
  background: white;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  opacity: 0.6;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.8; }
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #E2E8F0;
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

#### 错误状态

```css
.error-card {
  background: #FEF2F2;
  border: 1px solid #FEE2E2;
  border-left: 3px solid #EF4444;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.error-message {
  color: #991B1B;
  font-size: 14px;
  line-height: 1.6;
}
```

#### 空状态

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #1E293B;
  margin-bottom: 8px;
}

.empty-description {
  font-size: 14px;
  color: #64748B;
  line-height: 1.6;
}
```

---

## ⚡ 交互动画

### 微交互原则
- 持续时间：150-300ms
- 缓动函数：`ease-out`（进入）、`ease-in`（退出）
- 尊重 `prefers-reduced-motion`

### 关键动画

**按钮点击**：
```css
.button:active {
  transform: scale(0.98);
}
```

**卡片 hover**：
```css
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
```

**标签页切换**：
```css
.tab-content {
  animation: fadeIn 200ms ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**复制成功提示**：
```css
.copy-toast {
  animation: slideUp 200ms ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## ♿ 可访问性

### 键盘导航
- ✅ 所有交互元素可通过 Tab 键访问
- ✅ Tab 顺序符合视觉顺序
- ✅ 标签页支持左右箭头键切换
- ✅ 明显的 focus 状态（蓝色外框）

### 屏幕阅读器
- ✅ 使用语义化 HTML（`<button>`, `<section>`, `<article>`）
- ✅ 图标按钮添加 `aria-label`
- ✅ 标签页使用 `role="tablist"` 和 `role="tab"`
- ✅ 表单元素关联 `<label>`

### 颜色对比度
- ✅ 正文文字：4.5:1（#1E293B on #F8FAFC）
- ✅ 次要文字：4.5:1（#475569 on #F8FAFC）
- ✅ 按钮文字：7:1+（white on #3B82F6）

### 动画偏好
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 📋 实施检查清单

### 视觉质量
- [ ] 使用 SVG 图标（Heroicons/Lucide），不使用 emoji
- [ ] 所有图标尺寸一致（20x20px）
- [ ] 服务商颜色标识正确
- [ ] Hover 状态不引起布局偏移

### 交互
- [ ] 所有可点击元素添加 `cursor: pointer`
- [ ] Hover 状态提供清晰的视觉反馈
- [ ] 过渡动画流畅（150-300ms）
- [ ] Focus 状态对键盘用户可见

### 响应式
- [ ] 在 375px、768px、1024px 测试
- [ ] 内容适应窗口宽度
- [ ] 文字大小在小屏幕上可读

### 可访问性
- [ ] 所有图片有 alt 文本
- [ ] 表单输入有关联的 label
- [ ] 颜色不是唯一的信息传达方式
- [ ] 尊重 `prefers-reduced-motion`

---

## 🎯 参考 Easydict 的设计亮点

1. **简洁的布局**：单列布局，信息层次清晰
2. **柔和的配色**：蓝色系主色调，白色背景
3. **圆角设计**：8-12px 圆角，现代感
4. **微妙的阴影**：轻量级阴影，不过度
5. **流畅的动画**：快速响应（150-300ms）
6. **清晰的图标**：统一的图标风格
7. **优雅的间距**：充足的留白，不拥挤

---

## 📦 下一步行动

1. **创建新的 CSS 变量文件**：`frontend/src/styles/design-tokens.css`
2. **重构设置界面样式**：`frontend/src/styles/settings-panel.css`
3. **重构翻译界面样式**：`frontend/src/styles/translator.css`
4. **更新组件代码**：添加新的 className 和结构
5. **测试可访问性**：使用键盘和屏幕阅读器测试
6. **响应式测试**：在不同窗口尺寸下测试

---

*设计方案基于 UI/UX Pro Max 设计系统生成*
*参考 Easydict 的简洁优雅风格*
