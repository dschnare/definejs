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


Browser Support
--------------------

The following browsers have been tested:

IE 7/8/9
Chrome 15+
FF 7+
Safari 5.1
Opera 10+

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
        depsAsObject: true // support for dependencies to be sepcified as an object
    }

The `defaultDeps` property is defined to make developers aware that definejs does not set `["require", "exports", "module"]` as
default dependencies when no dependencies are specified.


Addendum to AMD
--------------------

Definejs has taken the liberty to introduce a few new signatuers to the `define()` function specified by AMD.
The typical signatures for `define()` still work as defined in the specification, but definejs provides the
following additional signatures:

`define({imports}, module value | module factory)`
-----------------------------------------------

Where 'imports' is an object where each key is the name of an import and whose value is a dependent module ID.

    define({a: 'a', b: 'b'}, {/* module properties */});

    define({a: 'a', b: 'b'}, function(imports) {
      return {
        /* imports.a and imports.b are the module values from loading 'a' and 'b' */
        /* module properties */
      };
    });


`define(module ID, {imports}, module value | module factory)`
-----------------------------------------------

 Where 'imports' is an object where each key is the name of an import and whose value is a dependent module ID.

    define('myModule', {a: 'a', b: 'b'}, {/* module properties */});

    define('myModule', {a: 'a', b: 'b'}, function(imports) {
      return {
        /* imports.a and imports.b are the module values from loading 'a' and 'b' */
        /* module properties */
      };
    });



-----------------------------------------------
The following signatures offer an object-literal technique, so that the arguments are
are explicitly named and easier to understand when reading code.

    define({module: module value | module factory})

    define({id: module ID, module: module value | module factory})

    define({imports: {imports}, module: module value | module factory})

    define({id: module ID, imports: {imports}, module: module value | module factory})