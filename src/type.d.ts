/**
 * RsRetry 初始化配置（完整状态）
 */
interface RsRetryConfig {
    /** CDN 完整域名带路径前缀，例如：mg.127.net/static/qiye-official */
    cdnDomain: string;
    /** 主域名，用于降级资源加载 */
    fallbackDomain: string;
    /** CDN 是否可用：null 未检测、true 可用、false 不可用 */
    cdnAvailable: boolean | null;
    /** CDN 探测超时时间（毫秒） */
    testTimeout: number;
    /** CDN 探测图片地址 */
    testImagePath: string;
}

/**
 * RsRetry.init 可接受的可选参数
 */
interface RsRetryInitOptions {
    cdnDomain?: string;
    fallbackDomain?: string;
    testTimeout?: number;
    testImagePath?: string;
}

type RsHandleType = "error" | "background";

interface RsRetryPublicAPI {
    init(options?: RsRetryInitOptions): void;
    test(callback: (isAvailable: boolean) => void): void;
    replaceAll(): void;
    replaceBackground(element: Element): void;
    checkElement(element: Element | string): void;
    getConfig(): RsRetryConfig | null;
    readonly config: RsRetryConfig | null;
}

interface RsRetrySentry {
    captureException(error: unknown): void;
}

interface Window {
    Sentry?: RsRetrySentry;
    RsRetry?: RsRetryPublicAPI;
}

