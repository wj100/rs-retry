interface RsRetryCongfig {
    cdnDomain: string;  // CDN 完整域名带路径前缀
    fallbackDomain: string;  // 使用当前主域
    testTimeout?: number;  // CDN 测试超时时间（毫秒）
    testImagePath?: string;  // CDN 测试图片路径
}

type RsHandleType = 'error' | 'background'