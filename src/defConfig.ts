/**
 * 默认 CDN 降级配置
 */
const defaultConfig: RsRetryConfig = {
    cdnDomain: "mg.127.net/static/qiye-official",
    fallbackDomain: typeof location !== "undefined" ? location.origin : "",
    cdnAvailable: null,
    testTimeout: 3000,
    testImagePath: "/new/img/logo.5d2411d5.png",
};

export default defaultConfig;

