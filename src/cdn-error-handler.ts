import defaultConfig from "./defConfig";

let cdnAvailable: null | boolean = null
let config = defaultConfig;

// ==================== 工具函数 ====================

/**
 * 获取 CDN URL 正则表达式（用于匹配和替换）
 * @returns {RegExp} 正则表达式
 */
function getCdnUrlRegex() {
    // 转义特殊字符，生成正则表达式
    // 匹配: (https?:)?//[config.cdnDomain]/
    const escapedDomain = config.cdnDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^(https?:)?//' + escapedDomain + '/', 'g');
}

/**
 * 获取 CDN 基础 URL（协议 + 域名）
 * @returns {string} CDN 基础 URL
 */
function getCdnBaseUrl() {
    // 从 cdnDomain 生成完整的基础 URL
    // config.cdnDomain -> https://[config.cdnDomain]
    return 'https://' + config.cdnDomain;
}

/**
 * 检查 URL 是否包含 CDN 域名
 * @param {string} url - 要检查的 URL
 * @returns {boolean}
 */
function isCdnUrl(url?: string) {
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
    return cdnUrl.replace(regex, config.fallbackDomain + '/');
}

/**
 * 标记元素已处理
 * @param {Element} element - 元素
 * @param {string} type - 处理类型: 'error' | 'background'
 */
function markElementProcessed(element: any, type: RsHandleType) {
    if (type === 'error') {
        element.dataset.cdnErrorHandled = 'true';
    } else if (type === 'background') {
        element.dataset.cdnBackgroundProcessed = 'true';
    }
}

/**
 * 检查元素是否已处理
 * @param {Element} element - 元素
 * @param {string} type - 处理类型
 * @returns {boolean}
 */
function isElementProcessed(element: any, type: RsHandleType) {
    if (type === 'error') {
        return element.dataset.cdnErrorHandled === 'true';
    } else if (type === 'background') {
        return element.dataset.cdnBackgroundProcessed === 'true';
    }
    return false;
}

// ==================== 资源错误处理 ====================

/**
 * 处理 SCRIPT 标签降级
 * @param {HTMLScriptElement} script - script 元素
 * @param {string} fallbackUrl - 降级 URL
 */
function handleScriptFallback(script: HTMLScriptElement, fallbackUrl: string) {
    const newScript = document.createElement('script');
    newScript.src = fallbackUrl;
    if (script.async !== undefined) newScript.async = script.async;
    if (script.defer !== undefined) newScript.defer = script.defer;
    if (script.type) newScript.type = script.type;
    document.head.appendChild(newScript);
    console.log('✅ 已创建降级 SCRIPT:', fallbackUrl);
}

/**
 * 处理 LINK (CSS) 标签降级
 * @param {HTMLLinkElement} link - link 元素
 * @param {string} fallbackUrl - 降级 URL
 */
function handleLinkFallback(link: HTMLLinkElement, fallbackUrl: string) {
    const newLink = document.createElement('link');
    newLink.rel = 'stylesheet';
    newLink.href = fallbackUrl;
    newLink.type = 'text/css';
    if (link.media) newLink.media = link.media;
    document.head.appendChild(newLink);
    console.log('✅ 已创建降级 CSS:', fallbackUrl);
}

/**
 * 处理 IMG 标签降级
 * @param {HTMLImageElement} img - img 元素
 * @param {string} fallbackUrl - 降级 URL
 */
function handleImageFallback(img: HTMLImageElement, fallbackUrl: string) {
    // 处理 <picture> 中的 <source> 标签
    const pictureParent = img.parentElement;
    if (pictureParent && pictureParent.tagName === 'PICTURE') {
        const sources = pictureParent.querySelectorAll('source[srcset*="' + config.cdnDomain + '"]');
        sources.forEach(function (source) {
            if (isElementProcessed(source as HTMLElement, 'error')) return;

            const sourceSrcset = source.getAttribute('srcset');
            if (sourceSrcset && isCdnUrl(sourceSrcset)) {
                const fallbackSrcset = generateFallbackUrl(sourceSrcset);
                source.setAttribute('srcset', fallbackSrcset);
                markElementProcessed(source as HTMLElement, 'error');
                console.log('🔄 替换 <source> srcset:', sourceSrcset, '→', fallbackSrcset);
            }
        });
    }

    // 处理 img 的 src
    // 先移除 src，触发浏览器清理错误状态
    img.removeAttribute('src');

    // 使用 setTimeout 确保浏览器已经处理了移除操作
    setTimeout(function () {
        img.setAttribute('src', fallbackUrl);
        console.log('✅ 已设置新 src:', fallbackUrl);

        // 监听新 URL 的加载结果
        img.onload = function () {
            console.log('✅ 主域图片加载成功:', fallbackUrl);
        };
        img.onerror = function () {
            console.error('❌ 主域图片加载失败:', fallbackUrl);
            img.style.display = 'none';  // 主域也失败，隐藏图片
        };
    }, 0);
}

/**
 * 处理单个资源错误
 * @param {Element} element - 出错的元素
 */
function handleResourceError(element: any) {
    const resourceUrl = element.src || element.href;

    // 检查是否已经处理过（主域资源也失败的情况）
    if (isElementProcessed(element, 'error')) {
        console.error('❌ 主域资源也加载失败:', resourceUrl);
        element.dataset.cdnErrorHandled = 'failed';

        // 图片兜底：隐藏
        if (element.tagName === 'IMG') {
            element.style.display = 'none';
        }
        return;
    }

    // 检查是否是 CDN 资源
    if (!isCdnUrl(resourceUrl)) {
        return;
    }

    console.warn('⚠️ CDN 资源加载失败:', resourceUrl);

    // 生成降级 URL
    const fallbackUrl = generateFallbackUrl(resourceUrl);
    console.log('🔄 尝试降级到主域:', fallbackUrl);

    // 标记为已处理
    markElementProcessed(element, 'error');

    // 根据标签类型处理
    const tagName = element.tagName;
    if (tagName === 'SCRIPT') {
        handleScriptFallback(element, fallbackUrl);
    } else if (tagName === 'LINK' && element.rel === 'stylesheet') {
        handleLinkFallback(element, fallbackUrl);
    } else if (tagName === 'IMG') {
        handleImageFallback(element, fallbackUrl);
    }
}

// ==================== 背景图处理 ====================

/**
 * 替换内联样式中的背景图
 * @param {Element} element - 元素
 * @returns {boolean} 是否已处理
 */
function replaceInlineBackgroundImage(element: any) {
    const inlineStyle = element.style.backgroundImage;
    if (!inlineStyle || !isCdnUrl(inlineStyle)) {
        return false;
    }

    const regex = getCdnUrlRegex();
    const newStyle = inlineStyle.replace(regex, config.fallbackDomain + '/');
    element.style.backgroundImage = newStyle;
    console.log('🎨 替换内联背景图:', inlineStyle, '→', newStyle);
    return true;
}

/**
 * 替换计算样式中的背景图（来自 CSS 文件）
 * @param {Element} element - 元素
 * @param {boolean} hasBgLazy - 是否有 bg-lazy 类
 */
function replaceComputedBackgroundImage(element: any, hasBgLazy: boolean) {
    const computedStyle = window.getComputedStyle(element).backgroundImage;
    if (!computedStyle || computedStyle === 'none' || computedStyle === 'inherit') {
        return;
    }

    // 提取所有 URL（可能有多张背景图）
    const urlMatches = computedStyle.match(/url\(["']?([^"')]+)["']?\)/g);
    if (!urlMatches) {
        return;
    }

    urlMatches.forEach(function (urlMatch) {
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
            console.log('🎨 记录 bg-lazy 背景图降级 URL:', originalUrl, '→', fallbackUrl);
        } else {
            // 对于非 bg-lazy 元素，直接设置内联样式
            const currentStyle = element.style.backgroundImage || '';
            if (currentStyle && currentStyle !== 'none') {
                // 替换 CDN URL（转义特殊字符）
                const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const newBgImage = currentStyle.replace(
                    new RegExp(escapedUrl, 'g'),
                    fallbackUrl
                );
                element.style.backgroundImage = newBgImage;
            } else {
                element.style.backgroundImage = 'url("' + fallbackUrl + '")';
            }
            console.log('🎨 替换 CSS 背景图:', originalUrl, '→', fallbackUrl, '元素:', element.className);
        }
    });
}

/**
 * 替换元素的背景图
 * @param {Element} element - 要处理的元素
 */
function replaceBackgroundImage(element: any) {
    // 1. 优先处理内联样式中的背景图
    if (replaceInlineBackgroundImage(element)) {
        return;
    }

    // 2. 检查是否有 bg-lazy 类（需要特殊处理）
    const hasBgLazy = element.classList.contains('bg-lazy');
    if (hasBgLazy) {
        // 临时移除 bg-lazy 类以检测背景图
        element.classList.remove('bg-lazy');
    }

    // 3. 处理计算样式中的背景图（来自 CSS 文件）
    replaceComputedBackgroundImage(element, hasBgLazy);

    // 4. 恢复 bg-lazy 类（如果原来有的话）
    if (hasBgLazy) {
        element.classList.add('bg-lazy');
    }
}

// ==================== 批量替换 ====================

/**
 * 批量替换所有 <source> 标签
 */
function replaceAllSources() {
    const sources = document.querySelectorAll('source[srcset*="' + config.cdnDomain + '"]');
    sources.forEach(function (source) {
        if (isElementProcessed(source, 'error')) return;

        const sourceSrcset = source.getAttribute('srcset');
        if (!sourceSrcset || !isCdnUrl(sourceSrcset)) return;

        const fallbackSrcset = generateFallbackUrl(sourceSrcset);
        source.setAttribute('srcset', fallbackSrcset);
        markElementProcessed(source, 'error');
        console.log('批量替换 <source>:', sourceSrcset, '→', fallbackSrcset);
    });
}

/**
 * 批量替换所有图片
 */
function replaceAllImages() {
    const images = document.querySelectorAll('img[src*="' + config.cdnDomain + '"]');
    images.forEach(function (img) {
        if (img instanceof HTMLImageElement) {


            if (isElementProcessed(img, 'error')) return;

            if (!isCdnUrl(img.src)) return;

            const fallbackUrl = generateFallbackUrl(img.src);
            markElementProcessed(img, 'error');
            img.src = fallbackUrl;
            console.log('批量替换 <img>:', img.src, '→', fallbackUrl);
        }
    });
}

/**
 * 批量替换所有背景图
 */
function replaceAllBackgroundImages() {
    console.log('🎨 开始检查背景图（包括 bg-lazy 元素）...');
    const allElements = document.querySelectorAll('*');
    allElements.forEach(function (element) {
        if (!isElementProcessed(element, 'background')) {
            replaceBackgroundImage(element);
        }
    });

    // 特殊处理：标记所有 bg-lazy 元素，在移除类时自动处理 CDN 降级
    const bgLazyElements = document.querySelectorAll('.bg-lazy');
    bgLazyElements.forEach(function (element) {
        if (element instanceof HTMLElement) {
            element.dataset.cdnFallbackPending = 'true';
        }
    });
}

/**
 * 批量替换页面中的 CDN 资源（用于预检测到 CDN 不可用时）
 */
function replaceAllCdnResources() {
    console.warn('🚨 CDN 不可用，批量替换所有资源');

    replaceAllSources();
    replaceAllImages();
    replaceAllBackgroundImages();
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
function testCdnAvailability(callback: Function) {
    // 没配置 不测试
    if (!config.testImagePath) {
        cdnAvailable = true;
    }
    // 如果已经测试过，直接返回结果
    if (cdnAvailable !== null) {
        callback(cdnAvailable);
        return;
    }

    console.log('🔍 测试 CDN 可用性...');

    // 使用一个小图片测试
    const testImg = new Image();
    let timer: any = null;
    let completed = false;

    function complete(isAvailable: boolean) {
        if (completed) return;
        completed = true;

        if (timer) clearTimeout(timer);
        cdnAvailable = isAvailable;

        console.log(isAvailable ? '✅ CDN 可用' : '❌ CDN 不可用');
        callback(isAvailable);
    }

    testImg.onload = function () {
        complete(true);
    };

    testImg.onerror = function () {
        complete(false);
    };

    // 超时处理
    timer = setTimeout(function () {
        complete(false);
    }, config.testTimeout);

    // 使用测试图片进行检测
    const testUrl = getCdnBaseUrl() + config.testImagePath + '?' + Date.now();
    testImg.src = testUrl;
}

// ==================== 事件监听 ====================

/**
 * 初始化全局资源错误监听器
 * 
 * 为什么需要 error 事件监听？
 * ====================
 * 1. 处理单个资源失败的情况（CDN 可用但某个资源加载失败）
 * 2. 处理动态添加的资源
 * 3. 实时响应资源加载失败
 * 
 * 局限性：
 * - ❌ 无法捕获 CSS 背景图加载失败（浏览器限制）
 * - ❌ 无法在资源加载前预判
 * 
 * 因此需要配合预检测机制使用
 */
function initErrorListener() {
    document.addEventListener('error', function (e) {
        const target = e.target;
        if (!(target instanceof Element)) {
            return
        }
        // 只处理有 src 或 href 的元素
        const resourceUrl = (target as any).src || (target as any).href;

        // 只处理有 src 或 href 的元素
        if (!resourceUrl) return;

        // 只处理 CDN 资源（不处理已经降级的主域资源）
        if (!isCdnUrl(resourceUrl)) return;

        // 处理 SCRIPT、LINK、IMG 标签
        if (target.tagName === 'SCRIPT' ||
            target.tagName === 'LINK' ||
            target.tagName === 'IMG') {
            handleResourceError(target);
        }
    }, true); // 捕获阶段
}

// ==================== 动态元素监听 ====================

/**
 * 处理新添加的元素（仅当 CDN 不可用时）
 * @param {Element} node - 新添加的元素
 */
function handleNewElement(node: any) {
    if (cdnAvailable !== false) return;

    // 处理 IMG 标签
    if (node.tagName === 'IMG' && node.src && isCdnUrl(node.src)) {
        if (!isElementProcessed(node, 'error')) {
            handleResourceError(node);
        }
        return;
    }

    // 处理 SOURCE 标签
    if (node.tagName === 'SOURCE' && node.srcset && isCdnUrl(node.srcset)) {
        if (!isElementProcessed(node, 'error')) {
            const fallbackSrcset = generateFallbackUrl(node.srcset);
            node.setAttribute('srcset', fallbackSrcset);
            markElementProcessed(node, 'error');
        }
        return;
    }

    // 处理 bg-lazy 元素
    if (node.classList && node.classList.contains('bg-lazy')) {
        node.dataset.cdnFallbackPending = 'true';
    }

    // 处理子元素
    if (node.querySelectorAll) {
        // 处理子元素中的图片
        const images = node.querySelectorAll('img[src*="' + config.cdnDomain + '"]');
        images.forEach(function (img: HTMLImageElement) {
            if (!isElementProcessed(img, 'error')) {
                handleResourceError(img);
            }
        });

        // 标记子元素中的 bg-lazy
        const bgLazyElements = node.querySelectorAll('.bg-lazy');
        bgLazyElements.forEach(function (element: any) {
            element.dataset.cdnFallbackPending = 'true';
        });

        // 处理子元素的背景图（延迟处理，确保 CSS 样式已应用）
        const allChildElements = node.querySelectorAll('*');
        allChildElements.forEach(function (element: any) {
            if (!isElementProcessed(element, 'background')) {
                setTimeout(function () {
                    replaceBackgroundImage(element);
                    markElementProcessed(element, 'background');
                }, 50);
            }
        });
    }

    // 处理元素本身的背景图（延迟处理，确保 CSS 样式已应用）
    if (!isElementProcessed(node, 'background')) {
        setTimeout(function () {
            replaceBackgroundImage(node);
            markElementProcessed(node, 'background');
        }, 50);
    }
}

/**
 * 监听动态添加的元素（用于处理后续动态添加的 CDN 资源）
 */
function observeDynamicElements() {
    if (!window.MutationObserver) return;

    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) { // Element node
                    handleNewElement(node);
                }
            });
        });
    });

    // 等待 body 元素准备好
    function startObserving() {
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    if (document.body) {
        startObserving();
    } else {
        // 如果 body 还没准备好，等待 DOMContentLoaded
        document.addEventListener('DOMContentLoaded', startObserving);
    }
}

// ==================== 批量替换执行 ====================

/**
 * 延迟检查背景图（确保 CSS 已完全加载）
 */
function delayedBackgroundCheck() {
    console.log('🔄 延迟检查背景图，确保 CSS 已加载...');
    const allElements = document.querySelectorAll('*');
    let processedCount = 0;

    allElements.forEach(function (element) {
        if (isElementProcessed(element, 'background')) return;

        const computedStyle = window.getComputedStyle(element).backgroundImage;
        if (!computedStyle || computedStyle === 'none' || computedStyle === 'inherit') return;

        const urlMatches = computedStyle.match(/url\(["']?([^"')]+)["']?\)/g);
        if (!urlMatches) return;

        urlMatches.forEach(function (urlMatch) {
            const url = urlMatch.match(/url\(["']?([^"')]+)["']?\)/);
            if (url && url[1] && isCdnUrl(url[1])) {
                replaceBackgroundImage(element);
                markElementProcessed(element, 'background');
                processedCount++;
            }
        });
    });

    if (processedCount > 0) {
        console.log('✅ 延迟检查发现并处理了 ' + processedCount + ' 个背景图');
    }
}

/**
 * 执行批量替换（确保 CSS 已加载）
 */
function executeReplaceAll() {
    // CDN 不可用，批量替换所有资源（包括背景图）
    replaceAllCdnResources();

    // 开始监听动态添加的元素
    observeDynamicElements();

    // 延迟再次检查，确保 CSS 已完全加载和应用
    setTimeout(delayedBackgroundCheck, 100);
}

// ==================== 初始化 ====================

/**
 * 初始化 CDN 降级处理
 * 
 * ⚠️ 执行时机说明（改成 UMD 后的关键问题）：
 * ====================
 * 改成 UMD 后，init() 是手动调用的，而不是自执行。
 * 这会导致执行时机可能不同：
 * 
 * 1. 如果 init() 调用时 document.readyState === 'loading'
 *    → 添加 DOMContentLoaded 监听器，等待 DOM 加载完成 ✅
 * 
 * 2. 如果 init() 调用时 document.readyState === 'interactive'
 *    → DOMContentLoaded 已触发或即将触发，使用 setTimeout 确保事件处理完成 ✅
 * 
 * 3. 如果 init() 调用时 document.readyState === 'complete'
 *    → 页面已完全加载，直接执行 ✅
 * 
 * 关键修复：确保无论何时调用 init()，预检测都能正确执行，
 * 从而保证 CSS 背景图的降级处理能够正常工作。
 * 
 * @param {Object} options - 配置选项
 * @param {string} options.cdnDomain - CDN 完整域名带路径前缀，默认: 'mg.127.net/static/qiye-official'
 * @param {string} options.fallbackDomain - 降级域名，默认: location.origin
 * @param {number} options.testTimeout - CDN 测试超时时间（毫秒），默认: 3000
 * @param {string} options.testImagePath - CDN 测试图片路径，默认: '/new/img/logo.5d2411d5.png'
 */
function init(options?: RsRetryCongfig) {
    // 合并配置
    config = Object.assign(config, options);

    // 如果没有指定 fallbackDomain，使用默认值
    if (!config.fallbackDomain && typeof location !== 'undefined') {
        config.fallbackDomain = location.origin;
    }

    // 初始化错误监听器
    initErrorListener();

    // 页面加载时预检测 CDN
    // ⚠️ 必须启用：CSS 背景图加载失败不会触发 error 事件，只能通过预检测处理
    if (typeof document !== 'undefined') {
        // 执行预检测的函数
        function doPreCheck() {
            console.log('🔍 开始检测 CDN 可用性...');
            testCdnAvailability(function (isAvailable: boolean) {
                if (!isAvailable) {
                    // CDN 不可用，执行批量替换
                    executeReplaceAll();
                } else {
                    console.log('✅ CDN 可用，无需批量替换');
                }
            });
        }

        // 根据文档状态决定何时执行
        if (document.readyState === 'loading') {
            // DOM 还在加载，等待 DOMContentLoaded 事件
            document.addEventListener('DOMContentLoaded', function () {
                console.log('🔍 页面 DOM 加载完成，开始检测 CDN 可用性...');
                doPreCheck();
            });
        } else if (document.readyState === 'interactive') {
            // DOM 已解析完成（DOMContentLoaded 已触发或即将触发）
            // 使用 setTimeout 确保 DOMContentLoaded 事件已经处理完成
            setTimeout(function () {
                console.log('🔍 DOM 已解析完成，开始检测 CDN 可用性...');
                doPreCheck();
            }, 0);
        } else {
            // document.readyState === 'complete'，页面完全加载
            // 直接执行，但需要确保 CSS 已加载
            console.log('🔍 页面已完全加载，开始检测 CDN 可用性...');
            doPreCheck();
        }

        // 在 window.onload 时再次检查（确保所有资源都已加载）
        if (typeof window !== 'undefined') {
            window.addEventListener('load', function () {
                if (cdnAvailable === false) {
                    console.log('🔄 window.onload 时再次检查背景图...');
                    const allElements = document.querySelectorAll('*');
                    allElements.forEach(function (element) {
                        if (!isElementProcessed(element, 'background')) {
                            replaceBackgroundImage(element);
                            markElementProcessed(element, 'background');
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
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!el || cdnAvailable !== false) return;

    // 检查元素本身
    if (!isElementProcessed(el, 'background')) {
        replaceBackgroundImage(el);
        markElementProcessed(el, 'background');
    }

    // 检查所有子元素
    const allChildElements = el.querySelectorAll('*');
    allChildElements.forEach(function (childElement) {
        if (!isElementProcessed(childElement, 'background')) {
            replaceBackgroundImage(childElement);
            markElementProcessed(childElement, 'background');
        }
    });
}

// ==================== 公共 API ====================

/**
 * 获取当前配置
 * @returns {Object} 配置对象
 */
function getConfig() {
    return config ? Object.assign({}, config) : null;
}

// 暴露公共 API
const publicAPI = {
    /**
     * 初始化 CDN 降级处理
     * @param {Object} options - 配置选项
     * @param {string} options.cdnDomain - CDN 完整域名带路径前缀
     * @param {string} options.fallbackDomain - 降级域名
     * @param {number} options.testTimeout - CDN 测试超时时间（毫秒）
     * @param {string} options.testImagePath - CDN 测试图片路径
     */
    init: init,

    /**
     * 测试 CDN 可用性
     * @param {Function} callback - 回调函数，接收 isAvailable 参数
     */
    test: function (callback: Function) {
        if (!config) {
            console.warn('⚠️ 请先调用 init() 初始化');
            return;
        }
        testCdnAvailability(callback);
    },

    /**
     * 批量替换所有资源
     */
    replaceAll: function () {
        if (!config) {
            console.warn('⚠️ 请先调用 init() 初始化');
            return;
        }
        replaceAllCdnResources();
    },

    /**
     * 替换单个元素的背景图
     * @param {Element} element - 要处理的元素
     */
    replaceBackground: function (element: any) {
        if (!config) {
            console.warn('⚠️ 请先调用 init() 初始化');
            return;
        }
        replaceBackgroundImage(element);
    },

    /**
     * 检查指定元素及其子元素的背景图（用于弹窗等动态内容）
     * @param {Element|string} element - 元素或选择器
     */
    checkElement: function (element: any) {
        if (!config) {
            console.warn('⚠️ 请先调用 init() 初始化');
            return;
        }
        checkElementBackground(element);
    },

    /**
     * 获取当前配置
     * @returns {Object} 配置对象（只读）
     */
    getConfig: getConfig
};

// 暴露 config 属性（只读，用于向后兼容 bg-lazy.js 等）
// 使用 Object.defineProperty 确保只读，并在 init 时更新
Object.defineProperty(publicAPI, 'config', {
    get: function () {
        return config ? Object.assign({}, config) : null;
    },
    enumerable: true,
    configurable: false
});

export default publicAPI;
