/*
 * @Author: 汪骏
 * @Date: 2025-10-24 20:24:22
 * @LastEditors: wangjun
 * @LastEditTime: 2025-11-03 20:34:49
 * @Description: 请填写简介
 */
/**
 * 背景图片懒加载脚本
 * 
 * 工作原理：
 * 1. CSS 中定义了 .bg-lazy { background-image: none !important; }
 * 2. 当元素滚动到视口时，移除 bg-lazy 类
 * 3. 移除类后，CSS 中定义的背景图片就会自动显示
 * 
 */
(function() {
    'use strict';
    
    // 配置参数
    var lazyClass = 'bg-lazy';          // 懒加载类名
    var loadedClass = 'bg-loaded';      // 加载完成后添加的类名
    var rootMargin = '250px';           // 提前加载距离
    var threshold = 0.01;               // 触发阈值
    
    /**
     * 加载背景图片（移除懒加载类）
     */
    function loadBackgroundImage(element) {
        // 移除懒加载类
        element.classList.remove(lazyClass);
        
        // 如果 CDN 不可用，需要在移除类后处理背景图降级
        if (window.RsRetry && window.RsRetry.cdnAvailable === false) {
            // 检查是否有预存的降级 URL
            if (element.dataset.cdnFallbackUrl) {
                // 直接应用降级 URL
                element.style.backgroundImage = 'url("' + element.dataset.cdnFallbackUrl + '")';
                console.log('🎨 应用 bg-lazy 背景图降级:', element.dataset.cdnFallbackUrl);
                delete element.dataset.cdnFallbackUrl;
            } else if (element.dataset.cdnFallbackPending === 'true') {
                // 延迟处理，确保浏览器已经应用了新的样式
                setTimeout(function() {
                    window.RsRetry.replaceBackground(element);
                }, 0);
            }
        }
        
        if (loadedClass) {
            element.classList.add(loadedClass);
        }
    }
    
    // 检查是否支持 IntersectionObserver
    if (!('IntersectionObserver' in window)) {
        // 降级：直接加载所有背景图片
        document.addEventListener('DOMContentLoaded', function() {
            var lazyBgElements = document.querySelectorAll('.' + lazyClass);
            lazyBgElements.forEach(function(element) {
                loadBackgroundImage(element);
            });
        });
        return;
    }
    
    // 创建 IntersectionObserver
    var bgLazyObserver = new IntersectionObserver(function(entries, observer) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var element = entry.target;
                loadBackgroundImage(element);
                observer.unobserve(element);
            }
        });
    }, {
        rootMargin: rootMargin,
        threshold: threshold
    });
    
    // 观察所有懒加载背景元素
    document.addEventListener('DOMContentLoaded', function() {
        var lazyBgElements = document.querySelectorAll('.' + lazyClass);
        lazyBgElements.forEach(function(element) {
            bgLazyObserver.observe(element);
        });
    });
})();