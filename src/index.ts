import handler from "./cdn-error-handler";

const RsRetry: RsRetryPublicAPI = {
    init: handler.init,
    test: handler.test,
    replaceAll: handler.replaceAll,
    replaceBackground: handler.replaceBackground,
    checkElement: handler.checkElement,
    getConfig: handler.getConfig,
    get config() {
        return handler.config;
    },
    get cdnAvailable() {
        return handler.cdnAvailable;
    },
};

export default RsRetry;

