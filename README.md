# Overview

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

However, others are welcome to take definejs as a base and integrate plugin support into their own build.

The [wiki](https://github.com/dschnare/definejs/wiki) contains several pages on the usage and API.

**NOTICE:** Like [RequireJS](http://requirejs.org/docs/api.html#define), definejs modules must map 1-to-1 to a file. The only exception is when writing modules in an embedded `<script>` on the page that includes definejs.


# define.amd property

    {
        plugins: false, // no plugin support
        pluginDynamic: false, // no dynamic plugin support
        multiversion: true, // support for loading multiple versions of a module
        defaultDeps: false, // there are no default dependencies like the AMD spec suggests
        jQuery: true // required to load jQuery 1.7+ as a module
        // (definejs does nothing special to manage multiple versions of jQuery, it is the
        //	developer's responsibility to create separate contexts when appropriate)
    }

The `defaultDeps` property is defined to make developers aware that definejs does not set `["require", "exports", "module"]` as
default dependencies when no dependencies are specified.


# Organization

This project is organized into the following partitions/abstractions.

- src

	This directory contains all the JavaScript source code for definejs and several AMD modules.

- min

	This directory contains the minified versions of each module and definejs produced from Rake.

- vendor

	This directory contains all the required third party binaries and source code.

	The following third party dependencies exist:

		- AjaxMin.exe (used to minify the JavaScript source -- Requires Windows)
		- jslint.js (used to test the JavaScript source)
		- rhino.jar (used to execute jslint.js)

- web

	This directory is a web project that tests definejs using the [amdjs-tests](https://github.com/amdjs/amdjs-tests) suite.

# Building

Ruby Rake is used to build minify and move around the minified code to the appropriate directories.
Use `rake -D` to list all the rake tasks. The `Rakefile` is commented quite well so you can read
this file to understand how the build process.


# Testing

Any web server can be used to serve up the testing project, but for convenience a Sinatra web app
has been written to get testing quickly.

To get started with the built-in Sinatra app run (requires [Bundler](http://gembundler.com/) and [Foreman](https://github.com/ddollar/foreman)):

Mac/Linux/Unix:

	bundle install
	foreman start

Windows (does not require Foreman)

	bundle install
	bundle exec ruby -Cweb app.rb -p 5000

Once the web server is running then simply point your browser to the [amdjs-tests](http://localhost:5000/amdjs-tests/tests/doh/runner.html?config=definejs/config.js&impl=definejs/define.js) and hit the play button. To kill the web server press `Ctr+C`.


# Support

The following list of environments will be updated as testing ensues:

-   IE 6/7/8/9 and IE10 testdrive
-   Chrome 15+
-   Firefox 3+
-   Safari 5+
-   Opera 10+