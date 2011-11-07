var define = (function(document, window, setTimeout, userAgent) {
    ///////////////////////////
    // Cross Browser Logging //
    ///////////////////////////
    function log() {
        var i, len, arg, br, text, space, body;

        body = document.body || log.buffer;
        space = function() { return document.createTextNode(" "); };
        br = function() { return document.createElement("br"); };
        text = function(text) { return document.createTextNode(text + ""); };
        len = arguments.length;

        if (body !== log.buffer && log.buffer) {
            body.appendChild(log.buffer);
            log.buffer = null;
        }

        for (i = 0; i < len; i++) {
            body.appendChild(text(arguments[i]));
            body.appendChild(space());
        }

        body.appendChild(br());

        log.defer();
    }
    log.buffer = document.createDocumentFragment();
    log.defer = function() {
        if (!document.body) {
            setTimeout(log.defer, 0);
        } else if (log.buffer) {
            document.body.appendChild(log.buffer);
            log.buffer = null;
        }
    };




    var globalDefine, queue, util, globalErrorHandler, Array, String;

    Array = ([]).constructor;
    String = ("").constructor;

    // Utility functions.
    util = {
        isFunction: function(o) {
            return typeof o === "function";
        },
        isArray: function(o) {
            return ({}).toString.call(o) === "[object Array]";
        },
        isString: function(o) {
            return o instanceof String || typeof o === "string";
        },
        isObject: function(o) {
            if (o === null || o === undefined) return false;
            return typeof o === "object";
        }
    };

    // The global error handler.
    globalErrorHandler = (function() {
        var dreading = [];

        return {
            error: function(fn) {
                if (util.isFunction(fn)) dreading.push(fn);
            },
            trigger: function(error) {
                var i, len = dreading.length;

                for (i = 0; i < len; i++) {
                    dreading[i](error);
                }
            }
        };
    }());

    //////////////////////////////////////
    // The Module Import Callback Queue //
    //////////////////////////////////////
    queue = (function() {
        var queue = [];
        queue.enqueue = function(o) {
            this.push(o);
        };
        queue.dequeue = (function() {
            var operation;
            // Use pop() for Chrome, Safari, and FireFox - Embedded scripts are always executed first.
            // Use shift for IE and Opera - Embedded scripts are always executed last.
            if(userAgent.search(/safari|chrome|firefox/i) >= 0) {
                operation = "pop";
            } else {
                operation = "shift";
            }

            return function() {
                return this[operation]();
            };
        }());
        queue.clear = function() {
            while (this.length) this.pop();
        };

        return queue;
    }());

    function makePromise() {
        var waiting = [], dreading = [], status = "unresolved", value;

        function trigger(value) {
            var a = status === "resolved" ? waiting : dreading;
            while (a.length) {
                a.shift()(value);
            }
        }

        return {
            status: function() {
                return status;
            },
            isResolved: function() {
                return status !== "unresolved";
            },
            resolve: function(v) {
                if (status !== "unresolved") throw new Error("Cannot resolve a promise that is already resolved.");
                value = v;
                status = "resolved";
                trigger();
            },
            error: function(msg) {
                value = msg;
                status = "error";
                trigger();
            },
            done: function(fn) {
                if (status === "resolved") {
                    fn(value);
                } else if (status === "unresolved") {
                    waiting.push(fn);
                }
            },
            fail: function(fn) {
                if (status === "error") {
                    fn(value);
                } else if (status === "unresolved") {
                    dreading.push(fn);
                }
            }
        };
    }

    function makeContext() {
        var moduleExports = {}, moduleIdAlias = {};

        return {
            saveModuleExports: function(moduleId, exports) {
                if (moduleId in moduleIdAlias) moduleId = moduleIdAlias[moduleId];
                moduleExports[moduleId] = exports;
            },
            getModuleExports: function(moduleId) {
                if (moduleId in moduleIdAlias) moduleId = moduleIdAlias[moduleId];
                return moduleExports[moduleId];
            },
            containsModuleExports: function(moduleId) {
                if (moduleId in moduleIdAlias) moduleId = moduleIdAlias[moduleId];
                return moduleId in moduleExports;
            },
            aliasModuleId: function(moduleId, alias) {
                moduleIdAlias[moduleId] = alias;
            }
        };
    }

    function makeConfig(o) {
        var config, key, urlArgs;

        config = {
            baseUrl: "",
            paths: {},
            urlArgs: "",
            timeout: 5000
        };

        if (!util.isObject(o)) return config;

        /////////////
        // baseUrl //
        /////////////
        if ("baseUrl" in o) {
            // Ensure the baseUrl ends with '/' if it's not the empty string.
            if (typeof o.baseUrl === "string" && o.baseUrl.length !== 0) {
                config.baseUrl = o.baseUrl;
                if (o.baseUrl.charAt(o.baseUrl.length - 1) !== "/") config.baseUrl += "/";
            }
        }

        /////////////
        // urlArgs //
        /////////////
        if ("urlArgs" in o) {
            // Ensure urlArgs is properly formatted and encoded.
            if (util.isString(o.urlArgs)) {
                config.urlArgs = "?" + o.urlArgs.replace(/^\?/, "");
            } else if (util.isObject(o.urlArgs)) {
                urlArgs = "";

                for (key in o.urlArgs) {
                    urlArgs = "&" + key + "=" + encodeURIComponent(o.urlArgs[key] + "");
                }

                if (urlArgs.charAt(0) === "&") urlArgs = urlArgs.substring(1);

                config.urlArgs = urlArgs.length ? "?" + urlArgs : urlArgs;
            }
        }

        ///////////
        // paths //
        ///////////
        if (util.isObject(o.paths)) config.paths = o.paths;

        /////////////
        // timeout //
        /////////////
        if (!isNaN(o.timeout) && parseFloat(o.timeout) > 0) config.timeout = parseFloat(o.timeout);

        return config;
    }

    // Loads a JavaScript file by using a <script> element.
    // onComplete will be called with the URL of the script when the script has loaded.
    // onError will be called with an error message if the script fails to load.
    function loadScript(url, onComplete, onError) {
        var script = document.createElement("script");

        script.onload = function() {
            script.onload = null;
            script.onreadystatechange = null;
            script.onerror = null;

            if (typeof onComplete === "function") onComplete(url);
        };
        script.onreadystatechange = function() {
            if (script.readyState === "complete" || script.readyState === "loaded") {
                script.onload();
            }
        };
        script.onerror = function() {
            script.onload = null;
            script.onreadystatechange = null;
            script.onerror = null;

            if (typeof onError === "function") onError(new Error("Failed to load script: " + url));
        };

        script.src = url;
        document.getElementsByTagName("head")[0].appendChild(script);
    }

    // Convert a module ID into a qualified URL.
    function toUrl(moduleId, baseUrl, basePath, paths, urlArgs, ext) {
        var key, url = moduleId;

        // If not extension is specified then assume '.js'.
        ext = ext || ".js";

        // Expand path aliases.
        for (key in paths) {
            url = url.replace(key, paths[key]);
        }

        // If the url is absolute or has an extension then we simply return it as is.
        if ((/^\/|^[a-z]+:/i).test(url) || (/\.[a-z]+$/i).test(url)) return url;

        // Handle relativeness.
        if (basePath) {
            if (url.substring(0, 2) === "./") {
                url = basePath + url.substring(2);
            } else if (url.substring(0, 3) === "../") {
                basePath = basePath.split("/");
                basePath.pop();
                basePath = basePath.join("/") + basePath.length ? "/" : "";
                url = basePath + url.substring(3);
            }
        }

        // Prepend the baseUrl.
        url =  baseUrl + url;

        // Append the extesion.
        url += ext;

        // Append any url arguments.
        url += urlArgs;

        return url;
    }

    // Turn a module ID into a path to be used when resolving a module to a URL.
    function toPath(moduleId, basePath, paths) {
        var i, s, path = moduleId;

        // Expand path aliases.
        for (key in paths) {
            path = path.replace(key, paths[key]);
        }

        // Handle relativeness.
        if (basePath) {
            if (path.substring(0, 2) === "./") {
                path = basePath + path.substring(2);
            } else if (path.substring(0, 3) === "../") {
                basePath = basePath.split("/");
                basePath.pop();
                basePath = basePath.join("/") + basePath.length ? "/" : "";
                path = basePath + path.substring(3);
            }
        }

        ///////////////////////////////////////////
        // Find the path portion of the moduleId //
        ///////////////////////////////////////////

        i = path.lastIndexOf("/");
        s = path.substring(0, i+1);

        // If the last '/' is not found in a relative or absolute portion of the path
        // then we retrieve the path upto and including the last '/'.
        if (i > 0 && s.search(/^\.\/|^\.\.\/|^[a-z]+:\//i) < 0) {
            path = path.substring(0, i+1);
        // If there are no '/' in the path then we set it to the empty string.
        } else if (i < 0) {
           path = "";
        }

        return path;
    }

    function isCircular(moduleId, currentModuleId, context) {
        var o;

        if (moduleId !== currentModuleId && moduleId in context) {
            o = context[moduleId];

            if (o.promise.isResolved()) return false;

            if (o.dependencies.contains(currentModuleId)) return true;

            o.dependencies.forEach(function(k, dep) {
                if (isCircular(dep, currentModuleId, context)) return true;
            });
        }

        return false;
    }

    function makeRequire(basePath, currentModuleId, context, onError) {
        require = function() {
            // require([dependencies], callback)
            if (util.isArray(arguments[0])) {
                if (util.isFunction(arguments[1])) {
                    (function(args) {
                        var deps = args[0], count = deps.length, fn = args[1];

                        function onComplete() {
                            if (--count === 0) fn();
                        }

                        while (deps.length) {
                            loadModule(context, deps.shift(), currentModuleId, basePath, onComplete, onError);
                        }
                    }(arguments));
                } else {
                    throw new Error("TypeError: Expected a callback function.");
                }

                return;
            // require(moduleId)
            } else if (util.isString(arguments[0])) {
                if (arguments[0] === "require") {
                    return makeRequire(basePath, currentModuleId, context, onError);
                }

                if (!context.containsModuleExports(arguments[0])) throw new Error("Module has not been exported into context: " + arguments[0]);
                return context.getModuleExports(arguments[0]);
            }

            throw new Error("TypeError: Expected a module ID.");
        };
        require.toUrl = function(resource) {
            var ext, moduleId, config = context.config;

            if (util.isString(resource) && (/\.[a-zA-Z]+$/).test(resource + "")) {
                resource += "";
                // Retrieve and remove the extension.
                ext = resource.match(/\.[a-zA-Z]+$/).pop();
                moduleId = resource.replace(/\.[a-zA-Z]+$/, "");
                // Convert to a URL but be sure to preserve the original extension and specify no URL args.
                return toUrl(resource, config.baseUrl, basePath, config.paths, "", ext);
            }

            throw new Error("TypeError: Expected a module ID of the form 'module-id.extension'.");
        };

        return require;
    }

    // Loads an AMD module by using a <script> element.
    // onComplete is called with the module exports if the module has successfully loaded.
    // onError will be called with an error message if the module or any of its
    // dependencies has failed to load.
    function loadModule(context, moduleId, currentModuleId, basePath, onComplete, onError) {
        onComplete = (function(fn) {
            return function() {
                if (util.isFunction(fn)) fn.apply(undefined, arguments);
            };
        }(onComplete));

        onError = (function(fn) {
            return function() {
                if (util.isFunction(fn)) fn.apply(undefined, arguments);
            };
        }(onError));

        var moduleUrl = toUrl(moduleId, context.config.baseUrl, basePath, context.config.paths, context.config.urlArgs);
        var modulePath = toPath(moduleId, basePath, context.config.paths);

        // if the module is 'loading' already then we complete with undefined (highly likely it's a circular dependency)
        if (moduleUrl in context) {
            onComplete(undefined);

        // else the module is 'importing' and it's circular then we complete with undefined, otherwise wait for its exports
        } else if (moduleId in context) {
            if (isCircular(moduleId, currentModuleId, context)) {
                onComplete(undefined);
            } else {
                context[moduleId].done(onComplete);
                context[moduleId].fail(onError);
            }

        // else the module is 'exported' then we complete with the exports
        } else if (context.containsModuleExports(moduleId)) {
            onComplete(context.getModuleExports(moduleId));

        // else we load
        } else {
            // Define the module as 'loading'.
            context[moduleUrl] = true;

            // Load the script that has the module definition.
            loadScript(moduleUrl, function() {
                // Clear the 'loading' status of the module.
                delete context[moduleUrl];

                // Import the module's dependencies.
                // pass the following: context, moduleId, modulePath, moduleUrl
                queue.dequeue()(context, moduleId, modulePath, moduleUrl, function(exports) {
                    onComplete(exports);
                }, function(error) {
                    onError(error);
                });
            },function(error) {
                delete context[moduleUrl];
                onError(error);
            });
        }
    }

    function makeDependencies(dependencies) {
        var count = 0;

        dependencies = dependencies || {};
        for (var k in dependencies) {
            if (dependencies.hasOwnProperty(k)) count += 1;
        }

        dependencies.count = function() { return count; };
        dependencies.forEach = function(fn) {
            for (var key in dependencies) {
                if (util.isFunction(dependencies[key])) continue;
                if (dependencies.hasOwnProperty(key)) fn.call(undefined, key, dependencies[key]);
            }
        };
        dependencies.contains = function(moduleId) {
            for (var key in dependencies) {
                if (dependencies.hasOwnProperty(key) && dependencies[key] === moduleId) return true;
            }

            return false;
        };

        return dependencies;
    }

    function makeImports(asArray) {
        var commonJs, importedValues;

        importedValues = asArray ? [] : {};
        commonJs = {
            exports: null,
            module: null,
            require: null
        };

        return {
            commonJsExports: function() {
                return commonJs.exports;
            },
            importCommonJs: function(moduleId, moduleUrl, basePath, context, dependencies) {
                // Look for CommonJS dependencies and import them.
                dependencies.forEach(function(key, dep) {
                    switch (dep) {
                        case "require":
                            importedValues[key] = commonJs.require = makeRequire(basePath, moduleId, context, null /*TODO: onError*/);
                            commonJs.require.main = {id: moduleId, uri: moduleUrl};
                            delete dpendencies[key];
                            break;
                        case "exports":
                            importedValues[key] = commonJs.exports = {};
                            delete dependencies[key];
                            break;
                        case "module":
                            importedValues[key] = commonJs.module = {id: moduleId, uri: moduleUrl};
                            delete dependencies[key];
                            break;
                    }
                });
            },
            set: function(key, value) {
                importedValues[key] = value;
            },
            valueOf: function() {
                return importedValues;
            }
        };
    }

    function makeOptions(args) {
        var o, options = {
            moduleId: "",
            dependencies: makeDependencies()
        };

        // fn
        // id, [dependencies], fn | value
        if (args.length > 1 || util.isFunction(args[0])) {
            options.moduleId = util.isString(args[0]) ? args.shift() + "" : "";
            options.factory = (function(fn) {
                return function(imports) {
                    if (util.isFunction(fn)) {
                        if (util.isArray(imports)) {
                            return fn.apply(undefined, imports);
                        }
                        return fn.call(undefined, imports);
                    }

                    return fn;
                };
            }(args.pop()));
            options.dependencies = makeDependencies(args.pop());
        // {id, imports, module}
        } else if (util.isObject(args[0]) && "module" in args[0]) {
            o = args[0];

            if (util.isString(o.id)) options.moduleId = o.id + "";
            if (util.isObject(o.imports)) options.dependencies = makeDependencies(o.imports);

            options.factory = function(imports) {
                if (util.isFunction(o.module)) {
                    if (util.isArray(imports)) {
                        return o.module.apply(undefined, imports);
                    }
                    return o.module.call(undefined, imports);
                }

                return o.module;
            };
        // moduleValue
        } else {
            options.factory = function() {
                return args[0];
            };
        }

        return options;
    }

    function makeDefine(context) {
        function define() {
            var options, dependencies, imports, importingPromise;

            options = makeOptions(Array.prototype.slice.call(arguments));
            dependencies = options.dependencies;
            imports = makeImports(util.isArray(dependencies));
            importingPromise = makePromise();

            // Define the module as 'importing'.
            // This is used by modules that have an explicit ID so that circular dependencies can be detected.
            if (options.moduleId) {
                // Test if the module already exists.
                if (options.moduleId in context) {
                    globalErrorHanlder.trigger("Module '" + options.moduleId + "' has already been defined.");
                    // Exit.
                    return;
                } else {
                    context[options.moduleId] = {promise: importingPromise, dependencies: dependencies};
                }
            }

            // Enqueue a function that will import our dependencies.
            // The context here will be our 'parent' context.
            queue.enqueue(function(parentContext, moduleId, modulePath, moduleUrl, onComplete, onError) {
                var exports, ctx;

                // Override the onComplete and onError callbacks.
                onComplete = (function(fn) {
                    var count = options.dependencies.count();

                    return function(key, xprts) {
                        // onComplete has been called with exports from a module being loaded.
                        if (count) {
                            imports.set(key, xprts);
                        }

                        if (count === 0 || --count === 0) {
                            try {
                                // When all dependencies are imported define the module as 'exported'.
                                exports = options.factory(imports.valueOf());
                                ctx.saveModuleExports(moduleId, exports);

                                // Get rid of our 'importing' state for this module.
                                if (options.moduleId) delete ctx[options.moduleId];
                                delete ctx[moduleId];

                                if (util.isFunction(fn)) fn(exports);
                                importingPromise.resolve(exports);
                            } catch (error) {
                                onError(error);
                            }
                        }
                    };
                }(onComplete));

                onError = (function(fn) {
                    return function(error) {
                        delete ctx[moduleId];
                        if (options.moduleId) delete ctx[options.moduleId];

                        if (util.isFunction(fn)) {
                            fn(error);
                            importingPromise.error(error);
                        } else {
                            globalErrorHandler.trigger(error);
                        }
                    };
                }(onError));

                // If we are the global 'define' and our 'parent' context is not equal to our own
                // (i.e. our 'parent' has a custom context) then we clean up lingering
                // states on the global context and transfer it to our parent context and ensure
                // we load into our parent context.
                if (define === globalDefine) {
                    if (parentContext !== context && options.moduleId) {
                        parentContext[options.moduleId] = context[options.moduleId];
                        delete context[options.moduleId];
                    }

                    ctx = parentContext;

                // Else we are a customly created 'define' with its own context, so
                // we forcefully use our own context.
                } else {
                    ctx = context;
                }

                // Test if the module already exists.
                if (moduleUrl in ctx || ctx.containsModuleExports(moduleId)) {
                    onError(new Error("Module '" + moduleId + "' has already been defined."));
                    // Exit.
                    return;
                }

                // Attempt to import the CommonJS dependencies.
                try {
                    imports.importCommonJs(moduleId, moduleUrl, modulePath, ctx, dependencies);
                    exports = imports.commonJsExports();
                } catch (error) {
                    onError(error);
                    // Exit.
                    return;
                }

                // Define the module as 'importing', but use the 'actual' moduleId instead of the explicit moduleId.
                // This is so that either the explicit ID or the actual ID can used to determine if a module is importing.
                // This is used to detect circular dependencies.
                ctx[moduleId] = {key: moduleId, promise: importingPromise, dependencies: dependencies};

                // Alias the module ID with the ID explicitly set for this module (if specified).
                if (options.moduleId) ctx.aliasModuleId(moduleId, options.moduleId);

                // Save our CommonJS exports immediately so that calls to require() can retrieve them.
                if (exports) ctx.saveModuleExports(moduleId, exports);

                // Import our dependencies.
                if (dependencies.count()) {
                    dependencies.forEach(function(key, modId) {
                        loadModule(ctx, modId, moduleId, modulePath, function(xprts) {
                            onComplete(key, xprts);
                        }, onError);
                    });
                } else {
                    onComplete();
                }
            }); // queue.enqueue(fn)

            log("Define:", options.moduleId || "anon");

            // Set a timeout so that in the future we check for any remaining
            // 'import' callbacks on the queue. These callbacks will be from
            // embedded scripts on the HTML page. When we rung these callbacks
            // we use our context so that they are imported into our context.
            setTimeout(function() {
                // Import the dependencies for all embedded modules.
                if (queue.length) {
                    q = queue.slice();
                    queue.clear();

                    while (q.length) {
                        q.shift()(context, "", "", "");
                    }
                }
            }, 0);
        } // define()

        // Hook into the global error handler.
        define.error = globalErrorHandler.error;

        // Expose the crossbrowser log function.
        define.log = log;

        // Function to create a new context with its own configuration.
        define.context = function(config) {
            var context = makeContext();
            context.config = makeConfig(config);
            return makeDefine(context);
        };

        return define;
    }

    // Return and create our global 'define'.
    return globalDefine = (function() {
        var context = makeContext();
        context.config = makeConfig();
        return makeDefine(context);
    }());
}(document, window, setTimeout, window.navigator.userAgent || ""));