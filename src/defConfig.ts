/**
 * 默认 CDN 降级配置
 */
const defaultConfig: RsRetryConfig = {
    cdnDomain: "mg.127.net/static/qiye-official",
    fallbackDomain: typeof location !== "undefined" ? location.origin : "",
    testTimeout: 3000,
    testImagePath: undefined,
    enableSentry: false,
};

export default defaultConfig;

