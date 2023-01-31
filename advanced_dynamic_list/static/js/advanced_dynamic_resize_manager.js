odoo.define('advanced_dynamic_list.resize_event_manager', function (require) {
    "use strict";

    const resizeHandler = function (entries) {
        for (let entry of entries) {
            const listeners = entry.target.__resizeListeners__ || [];
            if (listeners.length) {
                listeners.forEach((fn) => {
                    fn(entry.contentRect);
                });
            }
        }
    };

    const addResizeListener = function (element, fn) {
        if (!element.__resizeListeners__) {
            element.__resizeListeners__ = [];
            element.__ro__ = new ResizeObserver(resizeHandler);
            element.__ro__.observe(element);
        }
        element.__resizeListeners__.push(fn);
    };

    const removeResizeListener = function (element, fn) {
        if (!element || !element.__resizeListeners__) return;
        if (fn) {
            element.__resizeListeners__.splice(
                element.__resizeListeners__.indexOf(fn), 1);
        } else {
            element.__resizeListeners__ = [];
        }
        if (!element.__resizeListeners__.length) {
            element.__ro__.disconnect();
        }
    };

    return {
        addResizeListener,
        removeResizeListener,
    }
})