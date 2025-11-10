/*
 * @Author: 汪骏
 * @Date: 2025-10-21 16:07:24
 * @LastEditors: wangjun
 * @LastEditTime: 2025-11-05 11:47:07
 * @Description: CDN 资源降级处理脚本
 *
 * 降级逻辑说明：
 * ============
 *
 * 1. 检测机制
 *    - 页面加载时（DOMContentLoaded）预检测 CDN 可用性
 *    - 监听全局 error 事件，捕获资源加载失败
 *    - 使用 MutationObserver 监听动态添加的元素
 *
 * 2. 降级策略
 *    - 如果 CDN 不可用，批量替换所有资源 URL
 *    - 如果 CDN 可用但单个资源失败，仅替换该资源
 *
 * 3. 资源类型处理
 *    - SCRIPT: 创建新 script 标签，保持 async/defer/type 属性
 *    - LINK (CSS): 创建新 link 标签，保持 media 属性
 *    - IMG: 移除 src 后重新设置，处理 <picture> 中的 <source>
 *    - 背景图: 替换内联样式或计算样式中的 background-image
 *
 * 4. 特殊处理
 *    - bg-lazy 类元素：延迟处理，等待 bg-lazy 类移除后再应用背景图
 *    - <picture> 元素：同时处理 <source> 标签的 srcset
 *    - 动态元素：使用 MutationObserver 监听并处理
 *
 * 5. URL 转换规则
 *    - CDN: https://[config.cdnDomain]/path/to/resource
 *    - 降级: https://[config.fallbackDomain]/path/to/resource
 */

import defaultConfig from "./defConfig";

type NullableBoolean = boolean | null;

let config: RsRetryConfig = { ...defaultConfig };
let cdnAvailable: NullableBoolean = null;
let initialized = false;

// ==================== 工具函数 ====================

/**
 * 获取 CDN URL 正则表达式（用于匹配和替换）
 * @returns {RegExp} 正则表达式
 */
function getCdnUrlRegex() {
    // 转义特殊字符，生成正则表达式
    // 匹配: (https?:)?//[config.cdnDomain]/
    const escapedDomain = config.cdnDomain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^(https?:)?//" + escapedDomain + "/", "g");
}

/**
 * 检查 URL 是否包含 CDN 域名
 * @param {string} url - 要检查的 URL
 * @returns {boolean}
 */
function isCdnUrl(url?: string | null) {
    if (!url) return false;
    // 使用配置中的 cdnDomain 进行检查
    return url.includes(config.cdnDomain);
}

/**
 * 生成降级 URL
 * @param {string} cdnUrl - CDN URL
 * @returns {string} 降级后的 URL
 */
function generateFallbackUrl(cdnUrl: string) {
    // URL 转换规则: CDN域名/xxx -> 当前主域/xxx
    const regex = getCdnUrlRegex();
    return cdnUrl.replace(regex, config.fallbackDomain + "/");
}

function isBackgroundFallbackEnabled() {
    return Boolean(config.testImagePath);
}

function getCdnBaseUrl() {
    return "https://" + config.cdnDomain;
}

/**
 * 标记元素已处理
 * @param {Element} element - 元素
 * @param {string} type - 处理类型: 'error' | 'background'
 */
function markElementProcessed(element: HTMLElement, type: RsHandleType) {
    if (type === "error") {
        element.dataset.cdnErrorHandled = "true";
    } else if (type === "background") {
        element.dataset.cdnBackgroundProcessed = "true";
    }
}

/**
 * 检查元素是否已处理
 * @param {Element} element - 元素
 * @param {string} type - 处理类型
 * @returns {boolean}
 */
function isElementProcessed(element: HTMLElement, type: RsHandleType) {
    if (type === "error") {
        return element.dataset.cdnErrorHandled === "true";
    } else if (type === "background") {
        return element.dataset.cdnBackgroundProcessed === "true";
    }
    return false;
}

function reportCdnError(resourceUrl: string) {
    if (!config.enableSentry || typeof window === "undefined") return;
    const sentry = window.Sentry;
    if (sentry && typeof sentry.captureException === "function") {
        sentry.captureException(new Error("CDN资源加载失败: " + resourceUrl));
    }
}

// ==================== 资源错误处理 ====================

/**
 * 处理 SCRIPT 标签降级
 * @param {HTMLScriptElement} script - script 元素
 * @param {string} fallbackUrl - 降级 URL
 */
function handleScriptFallback(script: HTMLScriptElement, fallbackUrl: string) {
    const newScript = document.createElement("script");
    newScript.src = fallbackUrl;
    if (script.async !== undefined) newScript.async = script.async;
    if (script.defer !== undefined) newScript.defer = script.defer;
    if (script.type) newScript.type = script.type;
    document.head.appendChild(newScript);
    console.log("✅ 已创建降级 SCRIPT:", fallbackUrl);
}

/**
 * 处理 LINK (CSS) 标签降级
 * @param {HTMLLinkElement} link - link 元素
 * @param {string} fallbackUrl - 降级 URL
 */
function handleLinkFallback(link: HTMLLinkElement, fallbackUrl: string) {
    const newLink = document.createElement("link");
    newLink.rel = "stylesheet";
    newLink.href = fallbackUrl;
    newLink.type = "text/css";
    if (link.media) newLink.media = link.media;
    document.head.appendChild(newLink);
    console.log("✅ 已创建降级 CSS:", fallbackUrl);
}

/**
 * 处理 IMG 标签降级
 * @param {HTMLImageElement} img - img 元素
 * @param {string} fallbackUrl - 降级 URL
 */
function handleImageFallback(img: HTMLImageElement, fallbackUrl: string) {
    // 处理 <picture> 中的 <source> 标签
    const pictureParent = img.parentElement;
    if (pictureParent && pictureParent.tagName === "PICTURE") {
        const sources = pictureParent.querySelectorAll("source[srcset*='" + config.cdnDomain + "']");
        sources.forEach((source) => {
            if (!(source instanceof HTMLElement)) return;
            if (isElementProcessed(source, "error")) return;

            const sourceSrcset = source.getAttribute("srcset");
            if (sourceSrcset && isCdnUrl(sourceSrcset)) {
                const fallbackSrcset = generateFallbackUrl(sourceSrcset);
                source.setAttribute("srcset", fallbackSrcset);
                markElementProcessed(source, "error");
                console.log("🔄 替换 <source> srcset:", sourceSrcset, "→", fallbackSrcset);
            }
        });
    }

    // 处理 img 的 src
    // 先移除 src，触发浏览器清理错误状态
    img.removeAttribute("src");

    // 使用 setTimeout 确保浏览器已经处理了移除操作
    setTimeout(() => {
        img.setAttribute("src", fallbackUrl);
        console.log("✅ 已设置新 src:", fallbackUrl);

        // 监听新 URL 的加载结果
        img.onload = () => {
            console.log("✅ 主域图片加载成功:", fallbackUrl);
        };
        img.onerror = () => {
            console.error("❌ 主域图片加载失败:", fallbackUrl);
            img.style.display = "none"; // 主域也失败，隐藏图片
        };
    }, 0);
}

/**
 * 处理单个资源错误
 * @param {Element} element - 出错的元素
 */
function handleResourceError(element: Element) {
    const resourceUrl = (element as HTMLImageElement).src || (element as HTMLLinkElement).href;

    // 检查是否已经处理过（主域资源也失败的情况）
    if (isElementProcessed(element as HTMLElement, "error")) {
        console.error("❌ 主域资源也加载失败:", resourceUrl);
        (element as HTMLElement).dataset.cdnErrorHandled = "failed";

        // 图片兜底：隐藏
        if (element.tagName === "IMG") {
            (element as HTMLImageElement).style.display = "none";
        }
        return;
    }

    // 检查是否是 CDN 资源
    if (!isCdnUrl(resourceUrl)) {
        return;
    }

    console.warn("⚠️ CDN 资源加载失败:", resourceUrl);

    // 生成降级 URL
    const fallbackUrl = generateFallbackUrl(resourceUrl!);
    console.log("🔄 尝试降级到主域:", fallbackUrl);

    // 标记为已处理
    markElementProcessed(element as HTMLElement, "error");

    // 根据标签类型处理
    const tagName = element.tagName;
    if (tagName === "SCRIPT") {
        handleScriptFallback(element as HTMLScriptElement, fallbackUrl);
    } else if (tagName === "LINK" && (element as HTMLLinkElement).rel === "stylesheet") {
        handleLinkFallback(element as HTMLLinkElement, fallbackUrl);
    } else if (tagName === "IMG") {
        handleImageFallback(element as HTMLImageElement, fallbackUrl);
    }

    if (resourceUrl) {
        reportCdnError(resourceUrl);
    }
}

// ==================== 背景图处理 ====================

/**
 * 替换内联样式中的背景图
 * @param {Element} element - 元素
 * @returns {boolean} 是否已处理
 */
function replaceInlineBackgroundImage(element: HTMLElement) {
    if (!isBackgroundFallbackEnabled()) {
        return false;
    }
    const inlineStyle = element.style.backgroundImage;
    if (!inlineStyle || !isCdnUrl(inlineStyle)) {
        return false;
    }

    const regex = getCdnUrlRegex();
    const newStyle = inlineStyle.replace(regex, config.fallbackDomain + "/");
    element.style.backgroundImage = newStyle;
    console.log("🎨 替换内联背景图:", inlineStyle, "→", newStyle);
    return true;
}

/**
 * 替换计算样式中的背景图（来自 CSS 文件）
 * @param {Element} element - 元素
 * @param {boolean} hasBgLazy - 是否有 bg-lazy 类
 */
function replaceComputedBackgroundImage(element: HTMLElement, hasBgLazy: boolean) {
    if (!isBackgroundFallbackEnabled()) {
        return;
    }
    const computedStyle = window.getComputedStyle(element).backgroundImage;
    if (!computedStyle || computedStyle === "none" || computedStyle === "inherit") {
        return;
    }

    // 提取所有 URL（可能有多张背景图）
    const urlMatches = computedStyle.match(/url\(["']?([^"')]+)["']?\)/g);
    if (!urlMatches) {
        return;
    }

    urlMatches.forEach((urlMatch) => {
        // 提取单个 URL
        const url = urlMatch.match(/url\(["']?([^"')]+)["']?\)/);
        if (!url || !url[1] || !isCdnUrl(url[1])) {
            return;
        }

        const originalUrl = url[1];
        const fallbackUrl = generateFallbackUrl(originalUrl);

        if (hasBgLazy) {
            // 对于 bg-lazy 元素，保存降级 URL，在移除类时再应用
            element.dataset.cdnFallbackUrl = fallbackUrl;
            console.log("🎨 记录 bg-lazy 背景图降级 URL:", originalUrl, "→", fallbackUrl);
        } else {
            // 对于非 bg-lazy 元素，直接设置内联样式
            const currentStyle = element.style.backgroundImage || "";
            if (currentStyle && currentStyle !== "none") {
                // 替换 CDN URL（转义特殊字符）
                const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const newBgImage = currentStyle.replace(new RegExp(escapedUrl, "g"), fallbackUrl);
                element.style.backgroundImage = newBgImage;
            } else {
                element.style.backgroundImage = 'url("' + fallbackUrl + '")';
            }
            console.log("🎨 替换 CSS 背景图:", originalUrl, "→", fallbackUrl, "元素:", element.className);
        }
    });
}

/**
 * 替换元素的背景图
 * @param {Element} element - 要处理的元素
 */
function replaceBackgroundImage(element: HTMLElement) {
    if (!isBackgroundFallbackEnabled()) {
        return;
    }
    // 1. 优先处理内联样式中的背景图
    if (replaceInlineBackgroundImage(element)) {
        return;
    }

    // 2. 检查是否有 bg-lazy 类（需要特殊处理）
    const hasBgLazy = element.classList.contains("bg-lazy");
    if (hasBgLazy) {
        // 临时移除 bg-lazy 类以检测背景图
        element.classList.remove("bg-lazy");
    }

    // 3. 处理计算样式中的背景图（来自 CSS 文件）
    replaceComputedBackgroundImage(element, hasBgLazy);

    // 4. 恢复 bg-lazy 类（如果原来有的话）
    if (hasBgLazy) {
        element.classList.add("bg-lazy");
    }
}

// ==================== 批量替换 ====================

/**
 * 批量替换所有 <source> 标签
 */
function replaceAllSources() {
    const sources = document.querySelectorAll('source[srcset*="' + config.cdnDomain + '"]');
    sources.forEach((source) => {
        if (!(source instanceof HTMLElement)) return;
        if (isElementProcessed(source, "error")) return;

        const sourceSrcset = source.getAttribute("srcset");
        if (!sourceSrcset || !isCdnUrl(sourceSrcset)) return;

        const fallbackSrcset = generateFallbackUrl(sourceSrcset);
        source.setAttribute("srcset", fallbackSrcset);
        markElementProcessed(source, "error");
        console.log("批量替换 <source>:", sourceSrcset, "→", fallbackSrcset);
    });
}

/**
 * 批量替换所有图片
 */
function replaceAllImages() {
    const images = document.querySelectorAll('img[src*="' + config.cdnDomain + '"]');
    images.forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;

        if (isElementProcessed(img, "error")) return;

        if (!isCdnUrl(img.src)) return;

        const fallbackUrl = generateFallbackUrl(img.src);
        markElementProcessed(img, "error");
        img.src = fallbackUrl;
        console.log("批量替换 <img>:", img.src, "→", fallbackUrl);
    });
}

/**
 * 批量替换所有背景图
 */
function replaceAllBackgroundImages() {
    if (!isBackgroundFallbackEnabled()) {
        return;
    }
    console.log("🎨 开始检查背景图（包括 bg-lazy 元素）...");
    const allElements = document.querySelectorAll("*");
    allElements.forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        if (!isElementProcessed(element, "background")) {
            replaceBackgroundImage(element);
        }
    });

    // 特殊处理：标记所有 bg-lazy 元素，在移除类时自动处理 CDN 降级
    const bgLazyElements = document.querySelectorAll(".bg-lazy");
    bgLazyElements.forEach((element) => {
        if (element instanceof HTMLElement) {
            element.dataset.cdnFallbackPending = "true";
        }
    });
}

/**
 * 批量替换页面中的 CDN 资源（用于预检测到 CDN 不可用时）
 */
function replaceAllCdnResources() {
    console.warn("🚨 CDN 不可用，批量替换所有资源");

    replaceAllSources();
    replaceAllImages();
    if (isBackgroundFallbackEnabled()) {
        replaceAllBackgroundImages();
    }
}

// ==================== CDN 可用性检测 ====================

/**
 * 测试 CDN 是否可用
 *
 * 为什么需要预检测？
 * ====================
 * 1. ⚠️ CSS 背景图加载失败不会触发 error 事件，只能通过预检测处理
 * 2. 提前发现 CDN 整体不可用，批量替换所有资源，避免逐个失败
 * 3. 提高用户体验：如果 CDN 不可用，立即批量替换，而不是等待资源逐个失败
 *
 * 与 error 事件监听的区别：
 * - 预检测：主动测试，发现 CDN 整体不可用，批量处理
 * - error 监听：被动响应，处理单个资源失败
 *
 * @param {Function} callback - 回调函数，接收 isAvailable 参数
 */
function testCdnAvailability(callback: (isAvailable: boolean) => void) {
    if (!config.testImagePath) {
        cdnAvailable = true;
        callback(true);
        return;
    }
    if (cdnAvailable !== null) {
        callback(cdnAvailable);
        return;
    }

    const testImg = new Image();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let completed = false;

    function complete(isAvailable: boolean) {
        if (completed) return;
        completed = true;

        if (timer) clearTimeout(timer);
        cdnAvailable = isAvailable;
        console.log(isAvailable ? "✅ CDN 可用" : "❌ CDN 不可用");
        callback(isAvailable);
    }

    testImg.onload = function () {
        complete(true);
    };

    testImg.onerror = function () {
        complete(false);
    };

    timer = setTimeout(function () {
        complete(false);
    }, config.testTimeout);

    testImg.src = getCdnBaseUrl() + config.testImagePath + "?" + Date.now();
}

// ==================== 事件监听 ====================

/**
 * 初始化全局资源错误监听器
 */
function initErrorListener() {
    window.addEventListener(
        "error",
        (e) => {
            const target = e.target;
            if (!(target instanceof Element)) {
                return;
            }
            const resourceUrl = (target as HTMLImageElement).src || (target as HTMLLinkElement).href;

            if (!resourceUrl) return;

            if (!isCdnUrl(resourceUrl)) return;

            if (
                target.tagName === "SCRIPT" ||
                target.tagName === "LINK" ||
                target.tagName === "IMG"
            ) {
                handleResourceError(target);
            }
        },
        true,
    );
}

// ==================== 动态元素监听 ====================

/**
 * 处理新添加的元素（仅当 CDN 不可用时）
 * @param {Element} node - 新添加的元素
 */
function handleNewElement(node: Element) {
    if (cdnAvailable !== false) return;

    if (node.tagName === "IMG" && (node as HTMLImageElement).src && isCdnUrl((node as HTMLImageElement).src)) {
        if (!isElementProcessed(node as HTMLElement, "error")) {
            handleResourceError(node);
        }
        return;
    }

    if (node.tagName === "SOURCE" && (node as HTMLSourceElement).srcset && isCdnUrl((node as HTMLSourceElement).srcset)) {
        if (!isElementProcessed(node as HTMLElement, "error")) {
            const fallbackSrcset = generateFallbackUrl((node as HTMLSourceElement).srcset);
            (node as HTMLSourceElement).setAttribute("srcset", fallbackSrcset);
            markElementProcessed(node as HTMLElement, "error");
        }
        return;
    }

    if (isBackgroundFallbackEnabled() && (node as HTMLElement).classList && (node as HTMLElement).classList.contains("bg-lazy")) {
        (node as HTMLElement).dataset.cdnFallbackPending = "true";
    }

    if ((node as HTMLElement).querySelectorAll) {
        const images = (node as HTMLElement).querySelectorAll('img[src*="' + config.cdnDomain + '"]');
        images.forEach((img) => {
            if (img instanceof HTMLImageElement) {
                if (!isElementProcessed(img, "error")) {
                    handleResourceError(img);
                }
            }
        });

        if (isBackgroundFallbackEnabled()) {
            const bgLazyElements = (node as HTMLElement).querySelectorAll(".bg-lazy");
            bgLazyElements.forEach((element) => {
                if (element instanceof HTMLElement) {
                    element.dataset.cdnFallbackPending = "true";
                }
            });

            const allChildElements = (node as HTMLElement).querySelectorAll("*");
            allChildElements.forEach((element) => {
                if (element instanceof HTMLElement && !isElementProcessed(element, "background")) {
                    setTimeout(() => {
                        replaceBackgroundImage(element);
                        markElementProcessed(element, "background");
                    }, 50);
                }
            });
        }
    }

    if (isBackgroundFallbackEnabled() && !isElementProcessed(node as HTMLElement, "background")) {
        setTimeout(() => {
            replaceBackgroundImage(node as HTMLElement);
            markElementProcessed(node as HTMLElement, "background");
        }, 50);
    }
}

/**
 * 监听动态添加的元素（用于处理后续动态添加的 CDN 资源）
 */
function observeDynamicElements() {
    if (!window.MutationObserver) return;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    handleNewElement(node as Element);
                }
            });
        });
    });

    function startObserving() {
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
        }
    }

    if (document.body) {
        startObserving();
    } else {
        document.addEventListener("DOMContentLoaded", startObserving);
    }
}

// ==================== 批量替换执行 ====================

/**
 * 延迟检查背景图（确保 CSS 已完全加载）
 */
function delayedBackgroundCheck() {
    if (!isBackgroundFallbackEnabled()) {
        return;
    }
    const allElements = document.querySelectorAll("*");
    let processedCount = 0;

    allElements.forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        if (isElementProcessed(element, "background")) return;

        const computedStyle = window.getComputedStyle(element).backgroundImage;
        if (!computedStyle || computedStyle === "none" || computedStyle === "inherit") return;

        const urlMatches = computedStyle.match(/url\(["']?([^"')]+)["']?\)/g);
        if (!urlMatches) return;

        urlMatches.forEach((urlMatch) => {
            const url = urlMatch.match(/url\(["']?([^"')]+)["']?\)/);
            if (url && url[1] && isCdnUrl(url[1])) {
                replaceBackgroundImage(element);
                markElementProcessed(element, "background");
                processedCount++;
            }
        });
    });

    if (processedCount > 0) {
        console.log("✅ 延迟检查发现并处理了 " + processedCount + " 个背景图");
    }
}

/**
 * 执行批量替换（确保 CSS 已加载）
 */
function executeReplaceAll() {
    replaceAllCdnResources();
    observeDynamicElements();
    if (isBackgroundFallbackEnabled()) {
        setTimeout(delayedBackgroundCheck, 100);
    }
}

// ==================== 初始化 ====================

/**
 * 初始化 CDN 降级处理
 * @param {Object} options - 配置选项
 * @param {string} options.cdnDomain - CDN 完整域名带路径前缀，默认: 'mg.127.net/static/qiye-official'
 * @param {string} options.fallbackDomain - 降级域名，默认: location.origin
 * @param {number} options.testTimeout - CDN 测试超时时间（毫秒），默认: 3000
 * @param {string} options.testImagePath - CDN 测试图片路径，默认: '/new/img/logo.5d2411d5.png'
 */
function init(options?: Partial<RsRetryConfig>) {
    config = {
        ...defaultConfig,
        ...options,
    };

    if (!config.fallbackDomain && typeof location !== "undefined") {
        config.fallbackDomain = location.origin;
    }

    cdnAvailable = null;
    initialized = true;

    initErrorListener();

    if (typeof document !== "undefined") {
        function doPreCheck() {
            testCdnAvailability((isAvailable) => {
                if (!isAvailable) {
                    executeReplaceAll();
                } else {
                    console.log(config.testImagePath?'✅ 探针检测CDN 可用':'✅ 无探针检测，默认CDN 可用');
                }
            });
        }

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                doPreCheck();
            });
        } else if (document.readyState === "interactive") {
            setTimeout(() => {
                doPreCheck();
            }, 0);
        } else {
            doPreCheck();
        }

        if (typeof window !== "undefined" && isBackgroundFallbackEnabled()) {
            window.addEventListener("load", () => {
                if (cdnAvailable === false) {
                    const allElements = document.querySelectorAll("*");
                    allElements.forEach((element) => {
                        if (element instanceof HTMLElement && !isElementProcessed(element, "background")) {
                            replaceBackgroundImage(element);
                            markElementProcessed(element, "background");
                        }
                    });
                }
            });
        }
    }
}

// ==================== 公共 API ====================

/**
 * 检查并处理指定元素及其子元素的背景图（用于弹窗等动态内容）
 * @param {Element|string} element - 元素或选择器
 */
function checkElementBackground(element: Element | string) {
    const el = typeof element === "string" ? document.querySelector(element) : element;
    if (!el || cdnAvailable !== false || !isBackgroundFallbackEnabled()) return;

    if (!isElementProcessed(el as HTMLElement, "background")) {
        replaceBackgroundImage(el as HTMLElement);
        markElementProcessed(el as HTMLElement, "background");
    }

    const allChildElements = (el as HTMLElement).querySelectorAll("*");
    allChildElements.forEach((childElement) => {
        if (!isElementProcessed(childElement as HTMLElement, "background")) {
            replaceBackgroundImage(childElement as HTMLElement);
            markElementProcessed(childElement as HTMLElement, "background");
        }
    });
}

/**
 * 获取当前配置
 * @returns {Object} 配置对象
 */
function getConfigSnapshot(): RsRetryConfig | null {
    if (!initialized) {
        return null;
    }
    return { ...config };
}

const publicAPI: RsRetryPublicAPI = {
    init,
    test(callback: (isAvailable: boolean) => void) {
        if (!initialized) {
            console.warn("⚠️ 请先调用 init() 初始化");
            return;
        }
        testCdnAvailability(callback);
    },
    replaceAll() {
        if (!initialized) {
            console.warn("⚠️ 请先调用 init() 初始化");
            return;
        }
        replaceAllCdnResources();
    },
    replaceBackground(element: Element) {
        if (!initialized) {
            console.warn("⚠️ 请先调用 init() 初始化");
            return;
        }
        replaceBackgroundImage(element as HTMLElement);
    },
    checkElement(element: Element | string) {
        if (!initialized) {
            console.warn("⚠️ 请先调用 init() 初始化");
            return;
        }
        checkElementBackground(element);
    },
    getConfig() {
        return getConfigSnapshot();
    },
    get config() {
        return getConfigSnapshot();
    },
    get cdnAvailable() {
        return cdnAvailable;
    },
};

export default publicAPI;
