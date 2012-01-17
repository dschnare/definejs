>   Author: Darren Schnare

>   Keywords: javascript,amd,browser,pure,lightweight

>   License: MIT ( http://www.opensource.org/licenses/mit-license.php )

>   Repo: https://github.com/dschnare/definejs


Definejs
====================


Installation
--------------------

The `src/define.js` file is the source file with inline commenting, and the `bin/define.min.js` file is the minified obsfucated source file.

To install, simply download one of the files above and include them via a `<script>` element.

The [wiki](https://github.com/dschnare/definejs/wiki) contains several pages on the usage and API.

**NOTICE:** Like [RequireJS](http://requirejs.org/docs/api.html#define), definejs modules must map 1-to-1 to a file. The only exception is when writing modules in an embedded `<script>`
on the page that includes definejs.

Browser Support
--------------------

The following browsers have been tested:

-   IE 6/7/8/9 and IE10 testdrive
-   Chrome 15+
-   FF 3+
-   Safari 5.1
-   Opera 10+

This list will be frequently updated as testing ensues.


Overview
--------------------

This implemtation of the [AMD sepcification](https://github.com/amdjs/amdjs-api/wiki/AMD) is solely targeted
at web browsers and only web browsers. The sole purpose of this project is to provide a no-frills, pure-to-spec,
browser-only implementation of the AMD specification.

The goals of this project include:

-   Lightweight AMD implementation for browser-only consumption.
-   Small surface area for testing and potential issues to arise.
-   Provide a pure-implementation for others to base their own AMD loaders from.

Definejs adheres to the core AMD specification, that is the entire specification is implemented except for plugin support.
I feel plugin support is better left out of the loader and instead developers should utilize modules to define custom behaviour
for their applications such as resource loading (i.e. text files, il8n localization, etc.), which tends to be what most AMD
plugins are focused on. Definejs manages modules well. Definejs is not a resource manager, it is designed to be a module manager.
Also by not poluting the AMD loader with plugin "plumbing" code we effectively reduce the surface area of the loader in general, making
it easier to maintain, test and debug.

However, others are welcome to take definejs as a base and integrate plugin support into their own "build".

define.amd property
--------------------

    {
        plugins: false, // no plugin support
        pluginDynamic: false, // no dynamic plugin support
        multiversion: true, // support for loading multiple versions of a module
        defaultDeps: false, // there are no default dependencies like the AMD spec suggests
    }

The `defaultDeps` property is defined to make developers aware that definejs does not set `["require", "exports", "module"]` as
default dependencies when no dependencies are specified.