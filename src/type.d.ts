interface RsRetryConfig {
    /** CDN 完整域名带路径前缀，例如：mg.127.net/static/qiye-official */
    cdnDomain: string;
    /** 主域名，用于降级资源加载 */
    fallbackDomain: string;
    /** CDN 探测超时时间（毫秒） */
    testTimeout: number;
    /** CDN 探测图片地址 */
    testImagePath: string;
}

type RsHandleType = "error" | "background";

interface RsRetryPublicAPI {
    init(options?: Partial<RsRetryConfig>): void;
    test(callback: (isAvailable: boolean) => void): void;
    replaceAll(): void;
    replaceBackground(element: Element): void;
    checkElement(element: Element | string): void;
    getConfig(): RsRetryConfig | null;
    readonly config: RsRetryConfig | null;
    readonly cdnAvailable: boolean | null;
}

interface RsRetrySentry {
    captureException(error: unknown): void;
}

interface Window {
    Sentry?: RsRetrySentry;
    RsRetry?: RsRetryPublicAPI;
}

