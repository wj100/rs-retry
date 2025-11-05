const defaultConfig: RsRetryCongfig = {
    cdnDomain: 'mg.127.net',  // CDN 完整域名带路径前缀
    fallbackDomain: typeof location !== 'undefined' ? location.origin : '',  // 使用当前主域
};

export default defaultConfig