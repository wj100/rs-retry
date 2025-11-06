# RsRetry - CDN资源自动降级处理工具

RsRetry 是一个专门用于处理CDN资源加载失败时自动降级到主域的工具。它可以自动检测并处理图片、CSS、JavaScript等资源的加载失败情况，确保网站内容的可靠展示。

## 特性

- 自动检测CDN可用性
- 支持图片、CSS、JavaScript等资源的自动降级
- 支持背景图片的自动降级
- 支持动态添加元素的实时处理
- 支持lazy-load背景图片的处理
- 轻量级，易于集成

## 安装

### 开发环境
```bash
npm install --save
```

### 线上环境
```html
<script src="https://qiye.163.com/js/rs-retry/rs-retry.0.0.1.umd.js"></script>
<script src="https://mail.qiye.163.com/static/external/lib/rs-retry/rs-retry.0.0.1.umd.js"></script>
<!-- 开发环境 -->
<script src="https://maildev.qiye.163.com/static/mimg/external/lib/rs-retry/rs-retry.0.0.1.umd.js"></script>
```

## 使用方法

### 基础用法

```html
<script src="https://chose.your.url/rs-retry.0.0.1.umd.js"></script>
<script>
    // 初始化配置
    RsRetry.Handler.init({
        cdnDomain: 'mg.127.net',  // CDN域名
        fallbackDomain: location.origin  // 降级域名（默认为当前域名）
    });
</script>
```

### API说明

#### RsRetry.init(config)
初始化CDN降级处理，需要在页面加载时调用。

```javascript
RsRetry.Handler.init({
    cdnDomain: 'mg.127.net',  // CDN域名（必填）
    fallbackDomain: location.origin,  // 降级域名（必填）
    testTimeout: 3000,  // CDN测试超时时间（可选，默认3000ms）
    testImagePath: '/path/to/test/image.png'  // CDN测试图片路径（可选）
});
```

#### RsRetry.Handler.test(callback)
手动测试CDN可用性。

```javascript
RsRetry.Handler.test((isAvailable) => {
    if (isAvailable) {
        console.log('CDN可用');
    } else {
        console.log('CDN不可用');
    }
});
```

#### RsRetry.Handler.getConfig()
获取当前配置（只读）。

```javascript
const config = RsRetry.Handler.getConfig();
console.log(config);
```

### 配置参数说明

#### RsRetryCongfig 接口定义

```typescript
interface RsRetryCongfig {
    cdnDomain: string;      // CDN完整域名带路径前缀（必填）
    fallbackDomain: string; // 降级域名（必填）
    testTimeout?: number;   // CDN测试超时时间（可选，默认3000ms）
    testImagePath?: string; // CDN测试图片路径（可选）
}
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| cdnDomain | string | 是 | - | CDN域名，如：'mg.127.net' |
| fallbackDomain | string | 是 | location.origin | 降级域名，默认为当前域名 |
| testTimeout | number | 否 | 3000 | CDN可用性测试的超时时间（毫秒） |
| testImagePath | string | 否 | - | 用于测试CDN可用性的图片路径 |


## 注意事项

1. 确保在页面早期初始化RsRetry，以便及时处理资源加载失败的情况。
2. 对于动态加载的内容，使用`checkElement`方法处理新添加的元素。
3. 背景图懒加载元素需要添加`bg-lazy`类名。
4. CDN域名配置需要完整且准确。
5. 降级域名需要确保能够访问到对应的资源。

## 开发环境

- Node.js >= 14.0.0
- TypeScript >= 4.0.0
- Vite >= 2.0.0

## 许可证

MIT