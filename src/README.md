Files
==================


-   define.js

    The source, with comments, for definejs itself.

-   browser.js

    A module that expots the following object:

        {
            window: window,
            document: document,
            navigator: window.navigator,
            console: window.console || {}
        }

-   dom-ready.js

    A module that exports a single function that accepts a function as an argument.
    The function specified will only be called when the DOM has completely been loaded,
    or will be called immediately if the DOM has already been loaded. The implementation
    of this module comes directly from the jQuery implementation of `domReady` event. In
    fact the source was copied from jQuery and converted to an AMD module.