// A module that exports a single function that accepts a function as an argument.
// The function specified will only be called when the DOM has completely been loaded,
// or will be called immediately if the DOM has already been loaded. The implementation
// of this module comes directly from the jQuery implementation of `domReady` event. In
// fact the source was copied from jQuery and converted to an AMD module.
/*global 'define'*/
define("dom-ready", ['browser'], function (browser) {
    "use strict";

    var ready, document, window, setTimeout, DOMContentLoaded, callbacks, toplevel;

    callbacks = [];
    ready = false;
    document = browser.document;
    window = browser.window;
    setTimeout = browser.setTimeout;

    function onReady() {
        // Make sure body exists, at least, in case IE gets a little overzealous.
        if (!document.body) {
            setTimeout(onReady, 1);
            return;
        }

        // Remember that the DOM is ready
        ready = true;

        var i, len = callbacks.length;

        for (i = 0; i < len; i += 1) {
            callbacks[i].call(document);
        }

        callbacks = [];
    }

    // The DOM ready check for Internet Explorer
    function doScrollCheck() {
        if (ready) {
            return;
        }

        try {
            // If IE is used, use the trick by Diego Perini
            // http://javascript.nwbox.com/IEContentLoaded/
            document.documentElement.doScroll("left");
        } catch (e) {
            setTimeout(doScrollCheck, 1);
            return;
        }

        // and execute any waiting functions
        onReady();
    }

    // Cleanup functions for the document ready method
    if (document.addEventListener) {
        DOMContentLoaded = function () {
            document.removeEventListener("DOMContentLoaded", DOMContentLoaded, false);
            onReady();
        };

    } else if (document.attachEvent) {
        DOMContentLoaded = function () {
            // Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
            if (document.readyState === "complete") {
                document.detachEvent("onreadystatechange", DOMContentLoaded);
                onReady();
            }
        };
    }

    // Catch cases where $(document).ready() is called after the
    // browser event has already occurred.
    if (document.readyState === "complete") {
        ready = true;
    } else {
        // Mozilla, Opera and webkit nightlies currently support this event
        if (document.addEventListener) {
            // Use the handy event callback
            document.addEventListener("DOMContentLoaded", DOMContentLoaded, false);

            // A fallback to window.onload, that will always work
            window.addEventListener("load", onReady, false);

        // If IE event model is used
        } else if (document.attachEvent) {
            // ensure firing before onload,
            // maybe late but safe also for iframes
            document.attachEvent("onreadystatechange", DOMContentLoaded);

            // A fallback to window.onload, that will always work
            window.attachEvent("onload", onReady);

            // If IE and not a frame
            // continually check to see if the document is ready
            toplevel = false;

            try {
                toplevel = window.frameElement === null;
            } catch (e) {}

            if (document.documentElement.doScroll && toplevel) {
                doScrollCheck();
            }
        }
    }

    return function (fn) {
        if (ready) {
            fn.call(document);
        } else if (typeof fn === "function") {
            callbacks.push(fn);
        }
    };
});