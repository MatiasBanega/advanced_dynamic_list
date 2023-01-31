odoo.define('advanced_dynamic_list.util', function (require) {
    "use strict";

    let win;
    if (typeof window !== "undefined") {
        win = window;
    } else if (typeof self !== "undefined") {
        win = self;
    } else {
        win = {};
    }

    const request =
        win.requestAnimationFrame ||
        win.webkitRequestAnimationFrame ||
        win.mozRequestAnimationFrame ||
        win.oRequestAnimationFrame ||
        win.msRequestAnimationFrame ||
        function (callback) {
            return win.setTimeout(callback, 1000 / 60);
        };

    const cancel =
        win.cancelAnimationFrame ||
        win.webkitCancelAnimationFrame ||
        win.mozCancelAnimationFrame ||
        win.oCancelAnimationFrame ||
        win.msCancelAnimationFrame ||
        function (id) {
            win.clearTimeout(id);
        };

    const cancelAnimationTimeout = (frame) => caf(frame.id);

    const requestAnimationTimeout = (callback, delay) => {
        let start;
        Promise.resolve().then(() => {
            start = Date.now();
        });

        const timeout = () => {
            if (Date.now() - start >= delay) {
                callback.call();
            } else {
                frame.id = raf(timeout);
            }
        };

        const frame = {
            id: raf(timeout),
        };

        return frame;
    };

    function advanced_dynamicGetScrollbarWidth() {
        const outer = document.createElement("div");
        outer.className = "ve-scrollbar-wrap";
        outer.style.visibility = "hidden";
        outer.style.width = "100px";
        outer.style.position = "absolute";
        outer.style.top = "-9999px";
        document.body.appendChild(outer);

        const widthNoScroll = outer.offsetWidth;
        outer.style.overflow = "scroll";

        const inner = document.createElement("div");
        inner.style.width = "100%";
        outer.appendChild(inner);

        const widthWithScroll = inner.offsetWidth;
        outer.parentNode.removeChild(outer);

        return widthNoScroll - widthWithScroll;
    }

    function getViewportOffset(element) {
        var doc = document.documentElement,
            box =
                typeof element.getBoundingClientRect !== "undefined"
                    ? element.getBoundingClientRect()
                    : 0,
            scrollLeft =
                (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0),
            scrollTop =
                (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0),
            offsetLeft = box.left + window.pageXOffset,
            offsetTop = box.top + window.pageYOffset;

        var left = offsetLeft - scrollLeft,
            top = offsetTop - scrollTop;

        return {
            left: left,
            top: top,
            right: window.document.documentElement.clientWidth - box.width - left,
            bottom: window.document.documentElement.clientHeight - box.height - top,
            right2: window.document.documentElement.clientWidth - left,
            bottom2: window.document.documentElement.clientHeight - top,
        };
    }

    function getMousePosition(event) {
        var x = 0,
            y = 0,
            doc = document.documentElement,
            body = document.body;
        if (!event) event = window.event;
        if (window.pageYoffset) {
            x = window.pageXOffset;
            y = window.pageYOffset;
        } else {
            x =
                ((doc && doc.scrollLeft) || (body && body.scrollLeft) || 0) -
                ((doc && doc.clientLeft) || (body && body.clientLeft) || 0);
            y =
                ((doc && doc.scrollTop) || (body && body.scrollTop) || 0) -
                ((doc && doc.clientTop) || (body && body.clientTop) || 0);
        }
        x += event.clientX;
        y += event.clientY;

        let right = doc.clientWidth - event.clientX;
        let bottom = doc.clientHeight - event.clientY;

        return { left: x, top: y, right, bottom };
    }

    function isNumber(val) {
        return typeof val === "number";
    }

    const ASC_SVG = `<?xml version="1.0" encoding="UTF-8"?><svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 9H43" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 16L13 8" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 8V42" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 19H39" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 29H35" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 39H31" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

    const DESC_SVG = `<?xml version="1.0" encoding="UTF-8"?><svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 8H43" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 41L6 33" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 7V41" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 18H39" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 28H35" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 38H31" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

    const PLUS_SVG = `<?xml version="1.0" encoding="UTF-8"?><svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.0605 10L24.0239 38" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24L38 24" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

    const MINUS_SVG = `<?xml version="1.0" encoding="UTF-8"?><svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5 24L38.5 24" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

    const MAGIC_FIELDS = [
        "id",
        "create_uid",
        "create_date",
        "write_uid",
        "write_date",
        "__last_update"
    ];

    return {
        raf: request,
        caf: cancel,
        cancelAnimationTimeout: cancelAnimationTimeout,
        requestAnimationTimeout: requestAnimationTimeout,
        advanced_dynamicGetScrollbarWidth: advanced_dynamicGetScrollbarWidth,
        getViewportOffset: getViewportOffset,
        getMousePosition: getMousePosition,
        isNumber: isNumber,
        MAGIC_FIELDS: MAGIC_FIELDS
    }
})
