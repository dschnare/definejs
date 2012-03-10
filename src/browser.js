// A module that exports common browser objects.
/*global 'define', 'window', 'document' */
define("browser", {
    window: window,
    document: document,
    navigator: window.navigator,
    console: window.console || {}
});