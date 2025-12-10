# RsRetry - CDN资源自动降级处理工具

RsRetry 是一个专门用于处理CDN资源加载失败时自动降级到主域的工具。它可以自动检测并处理图片、CSS、JavaScript等资源的加载失败情况，确保网站内容的可靠展示。

## 特性

- 自动检测CDN可用性
- 支持图片、CSS、JavaScript等资源的自动降级
- 支持背景图片的自动降级
- 支持动态添加元素的实时处理
- 轻量级，易于集成

## 安装

```html
<script src="https://cdn.jsdelivr.net/npm/rs-retry@1.0.0/dist/rs-retry.1.0.0.umd.js"></script>
```

## 使用方法

### 基础用法

```html
<script src="https://chose.your.url/rs-retry.0.0.1.umd.js"></script>
<script>
    RsRetry.init({
        cdnDomain: 'mg.127.net/static/qiye-official',
        fallbackDomain: location.origin,
        testTimeout: 3000,
        // 需要背景图降级时提供测试图片路径
        // testImagePath: '/health/check.png',
        enableSentry: true
    });

    // 可选：监听检测结果
    RsRetry.test((isAvailable) => {
        console.log('CDN 可用性：', isAvailable);
    });
</script>
```

在支持 ES Module 的构建环境，也可以按需导入：

```ts
import RsRetry from 'rs-retry';

RsRetry.init({
    cdnDomain: 'mg.127.net/static/qiye-official',
});

```

### API说明

- `RsRetry.init(options)`：初始化。
- `RsRetry.test(callback)`：立即触发一次 CDN 检测。
- `RsRetry.replaceAll()`：手动触发降级（包括背景图，当配置了 `testImagePath`）。
- `RsRetry.replaceBackground(element)`：处理指定元素的背景图。
- `RsRetry.checkElement(element)`：检查cdn可用性并处理元素及其子元素的背景图，主要给“后插入的整块内容”兜底用。
- `RsRetry.getConfig()`：返回当前配置快照。
- `RsRetry.config`：配置快照的 getter。
- `RsRetry.cdnAvailable`：最近一次检测结果（`null/true/false`）。

### 配置参数说明

#### RsRetryCongfig 接口定义

```typescript
interface RsRetryConfig {
    cdnDomain: string;
    fallbackDomain: string;
    testTimeout: number;
    testImagePath?: string; // 提供时自动启用背景图降级
    enableSentry?: boolean; // 默认 false，可开启 Sentry 错误上报
}
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| cdnDomain | string | 是 | - | CDN 域名（可包含路径前缀） |
| fallbackDomain | string | 是 | `location.origin` | 降级目标域名 |
| testTimeout | number | 否 | 3000 | CDN 可用性检测超时时间（毫秒） |
| testImagePath | string | 否 | - | 探测图片路径，设置后开启背景图降级 |
| enableSentry | boolean | 否 | false | 是否启用 Sentry 上报 |


## 注意事项

1. 确保在页面早期初始化RsRetry，以便及时处理资源加载失败的情况。
2. 只在需要背景图降级时提供 `testImagePath`，否则不会触发预检测。
3. 对于动态加载的内容，使用 `checkElement` 方法处理新添加的元素。
4. 背景图懒加载元素需要添加 `bg-lazy` 类名，且需在 `bg-lazy.js` 中引入本库。
5. CDN 与主域的资源路径结构需一致，确保降级后地址有效。

## 开发环境

- Node.js >= 14.0.0
- TypeScript >= 4.0.0
- Vite >= 2.0.0

## 许可证

MIT