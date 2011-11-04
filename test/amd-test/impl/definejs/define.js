/**
 * Creates a global 'define' function that adheres to the AMD specification.
 *
 * How Modules Are Loaded (simplified)
 *
 * 1) Module ID is resolved to a URL.
 * 2) The URL is used to load the module script via <script> element if the module has not been loaded or is curently loading.
 * 3) Once the script has loaded, it executes and performs the following:
 *      1) Creates a promise and saves it on the current context to aid in circular detection in embedded scripts.
 *      2) Enqueues a "run()" function to be called by the module that loaded this module.
 *      3) Deffers checking the queue for the presence of the "run()" function from step 2.
 *      4) Control goes back to the "onload()" handler defined in the module that loaded this one and the following is performed:
 *          1) A "run()" function is dequeued and executed with arguments pertaining to this module.
 *          2) The "run()" function returns a promise that will be resolved with its exports once all its dependencies have been loaded.
 *          3) When the promise from the "run()" function has been resolved, the value is cached into the context and the promise for the
 *          loading script is resolved.
 *      5) When control comes back to the module definition call and if the "run()" function is present in the queue then this module
 *      is being defined in an embedded script and a function that calls all queued up "run()" functions will be deferred until all modules
 *      in the embedded script has had a chance to define themselves.
 */
var define = (function(document) {
    "use strict";

    var Array, globalDefine, errorCallback, queue, lib, makeDefine;

    Array = ([]).constructor;
    errorCallback = function(error) {
        throw error;
    };
    queue = (function() {
        var q = [];

        q.enqueue = function(value) {
            this.push(value);
        };
        q.dequeue = function() {
            return this.shift();
        };
        q.peek = function() {
            return this[0];
        };
        q.isEmpty = function() {
            return this.length === 0;
        };
        q.clear = function() {
            while (this.length) this.pop();
        };
        q.contains = function(o) {
            var i = this.length;
            while (i--) {
                if (this[i] === o) return true;
            }
            return false;
        };
        q.toArray = function() {
            return this.slice();
        };

        return q;
    }());

    lib = {
        util: {
            defer: function(fn) {
                setTimeout(fn, 1);
            },
            isArray: function(o) {
                return ({}).toString.call(o) === "[object Array]";
            },
            arrayIndexOf: function(a, e) {
                if (!a) return -1;

                var i, len = a.length;
                for (i = 0; i < len; i++) {
                    if (a[i] === e) return i;
                }
                return -1;
            },
            clone: (function() {
                var typeOf = function(o) {
                    if (lib.util.isArray(o)) return "array";
                    if (o === null) return "null";
                    if (o instanceof Date) return "date";
                    return typeof o;
                };

                return function(o) {
                    var type, result, key, i;

                    type = typeOf(o);

                    switch(type) {
                        case "array":
                            result = o.slice();
                            i = result.length;
                            while (i--) {
                                result[i] = lib.util.clone(result[i]);
                            }
                            return result;
                        case "object":
                            result = {};
                            for (key in o) {
                                result[key] = lib.util.clone(o[key]);
                            }
                            return result;
                        case "date":
                            return new Date(o.getTime());
                    }

                    return o;
                };
            }())
        },
        makePromise: (function() {
            var isPromise, makePromise;

            isPromise = function(o) {
                if (o) {
                    if (typeof o.complete === "function" &&
                        typeof o.error === "function") {
                        return true;
                    }
                }
                return false;
            };

            makePromise = function() {
                var status = "unresolved", complete = [], error = [], val, internalResolve;

                internalResolve = function(st, value) {
                    status = st;
                    val = value;

                    var a = status === "resolved" ? complete : error;

                    for (var i = 0, len = a.length; i < len; i++) {
                        try {
                            a[i](val);
                        } catch (ignore) {}
                    }

                    complete = [];
                    error = [];
                };

                return {
                    status: function() {
                        return status;
                    },
                    resolve: function(value) {
                        if (status === "unresolved") {
                            if (isPromise(value)) {
                                status = "pending";
                                value.complete(function(value) {
                                    internalResolve("resolved", value);
                                });
                                value.error(function(value) {
                                    internalResolve("error", value);
                                });
                            } else {
                                internalResolve("resolved", value);
                            }
                        } else {
                            throw new Error("Promise is already resolved.");
                        }
                    },
                    smash: function(value) {
                        if (status === "unresolved") {
                            internalResolve("error", value);
                        }
                    },
                    complete: function(fn) {
                        if (status === "resolved") {
                            fn(val);
                        } else if (status !== "error") {
                            complete.push(fn);
                        }

                        return this;
                    },
                    error: function(fn) {
                        if (status === "error") {
                            fn(val);
                        } else if (status !== "resolved") {
                            error.push(fn);
                        }

                        return this;
                    },
                    promise: function() {
                        return {
                            complete: this.complete,
                            error: this.error
                        };
                    }
                }
            };

            makePromise.isPromise = isPromise;

            return makePromise;
        }()),
        makePromiseCollection: function() {
            var count = 0, promise, complete, error, values = [];

            complete = function(value) {
                count -= 1;
                values.push(value);
                if (count === 0) {
                    promise.resolve(values);
                    values = [];
                }
            };
            error = function(value) {
                count = 0;
                promise.smash(value);
            };

            promise = lib.makePromise();
            promise.add = function(promise) {
                if (this.status() !== "unresolved") {
                    throw new Error("Cannot add promise to promise colleciton that is already been resolved.");
                }

                count += 1;
                promise.complete(complete);
                promise.error(error);
            };
            return promise;
        },
        resource: {
            expandPath: function(str, context) {
                var path, paths = context.config.paths;

                for (path in paths) {
                    str = str.replace(path, paths[path]);
                }

                return str.replace(/(^\w+:)?\/{2,}/g, function($0, $1) {
                    if ($1) return $0;
                    return "/";
                });
            },
            makeResourceId: function(resourceIdStr, context) {
                var extensionReg, protocolReg;

                extensionReg = /\.[a-zA-Z]+$/;
                protocolReg = /^\w+:/
                resourceIdStr += "";

                return {
                    toPath: function() {
                        var i, path = resourceIdStr;

                        // Expand any aliased path names.
                        path = lib.resource.expandPath(path, context);

                        // Remove relativeness.
                        if (path.indexOf("./") === 0) path = path.substring(2);

                        // Remove the protocol.
                        path = path.replace(protocolReg);

                        // Apply the baseUrl.
                        path = context.config.baseUrl + path;

                        // Already a path.
                        if (path.charAt(path.length - 1) === "/" || path.length === 0) return path;

                        // Get the path.
                        i = path.lastIndexOf("/");
                        if (i > 0) path = path.substring(0, i + 1);

                        return "";
                    },
                    toUrl: function(basePath, defaultExtension) {
                        var config, url = resourceIdStr;

                        // Expand any aliased path names.
                        url = lib.resource.expandPath(url, context);

                        // If the url is absolute or has an extension then we simply return it as is.
                        if (url.charAt(0) === "/" || protocolReg.test(url) || extensionReg.test(url)) return url;

                        defaultExtension = defaultExtension || ".js";
                        config = context.config;
                        basePath = basePath || "";
                        basePath += "";

                        // Handle relative module IDs.
                        if (url.indexOf("./") === 0) url = basePath + url.substring(2);
                        if (url.indexOf("../") === 0) url = basePath + url.substring(3);

                        // Prepend the baseUrl.
                        url = config.baseUrl + url;

                        // Append the default extesion.
                        url += defaultExtension;

                        // Append any url arguments.
                        url += config.urlArgs;

                        return url;
                    },
                    toString: function() {
                        return resourceIdStr;
                    },
                    valueOf: function() {
                        return resourceIdStr;
                    }
                }
            }
        },
        define: {
            makeContext: function() {
                var data, _alias, context;

                data = {};
                _alias = {};

                context = {
                    get: function(name) {
                        if (typeof name === "string") {
                            return data[name];
                        }
                    },
                    set: function(name, value) {
                        if (typeof name === "string") {
                            data[name] = value;

                            if (name in _alias) {
                                name = _alias[name];
                                data[name] = value;
                            }
                        }
                    },
                    contains: function(name) {
                        return name in data;
                    },
                    alias: function(name, alias) {
                        if (typeof name === "string" && typeof alias === "string") {
                            _alias[name] = alias;
                            data[alias] = data[name];
                        }
                    }
                };

                return context;
            },
            makeConfig: function(o) {
                var key, urlArgs;

                o = lib.util.clone(o);

                if (!o || typeof o !== "object") o = {};

                // Ensure the baseUrl ends with '/' if it's not the empty string.
                if (typeof o.baseUrl === "string" && o.baseUrl.length !== 0) {
                    if (o.baseUrl.charAt(o.baseUrl.length - 1) !== "/") o.baseUrl += "/";
                } else {
                    o.baseUrl = "";
                }

                // Ensure urlArgs is properly formatted and encoded.
                if (typeof o.urlArgs === "string") {
                    o.urlArgs = "?" + o.urlArgs.replace(/^\?/, "");
                } else if (typeof o.urlArgs === "object") {
                    urlArgs = "";

                    for (key in o.urlArgs) {
                        urlArgs = "&" + key + "=" + encodeURIComponent(o.urlArgs[key] + "");
                    }

                    if (urlArgs.charAt(0) === "&") urlArgs = urlArgs.substring(1);

                    o.urlArgs = "?" + urlArgs;
                } else {
                    o.urlArgs = "";
                }

                if (typeof o.paths !== "object") o.paths = {};

                if (!isFinite(o.timeout) || o.timeout <= 0) {
                    o.timeout = 5000;
                }

                return o;
            },
            makeOptions: (function() {
                var inspector = {
                    shouldInspect: function(options) {
                        return typeof options.module === "function" && (!options.imports || options.imports.length === 0);
                    },
                    inspect: function(options) {
                        var script, args, arg, i, len, reg, result, imports = [];

                        script = options.module.toString();
                        args = /^function\s*\((.*?)\)/.exec(script)[1];

                        if (args) {
                            args = args.split(",");
                            len = args.length;
                            for (i = 0; i < len; i++) {
                                arg = args[i].replace(/^\s+|\s+$/g, "");
                                switch (arg) {
                                    case "require":
                                    case "exports":
                                    case "module":
                                        imports.push(arg);
                                        break;
                                    default:
                                        throw new Error("Unrecognized dependency '" + arg + "' in script: " + script);
                                }
                            }
                        }

                        reg = /require\(('|")(.+?)\1\)/g;
                        result = reg.exec(script);
                        while (result) {
                            imports.push(result[2]);
                            result = reg.exec(script);
                        }

                        options.imports = imports;
                    }
                };

                return function(options) {
                    var deps;
                    // makeOptions(fn)
                    // makeOptions(id, [imports], fn | value)
                    if (arguments.length > 1 || typeof options === "function") {
                        // id, [deps], module
                        deps = Array.prototype.slice.call(arguments);

                        options = {
                            id: typeof deps[0] === "string" ? deps.shift() : "",
                            module: deps.pop(),
                            imports: deps[0]
                        };
                    // makeOptions(value)
                    } else if (typeof options !== "object") {
                        options = {module: options};
                    // makeOptions({value})
                    } else if (options && typeof options === "object" && !("module" in options)) {
                        options = {module: options};
                    }
                    // makeOptions({id:id, imports:[imports], module:fn | value})
                    // makeOptions({id:id, imports:{imports}, module:fn | value})
                    // else {}

                    if ("id" in options) {
                        if (typeof options.id !== "string") {
                            options.id += "";
                        }

                        if (options.id.indexOf("./") === 0) options.id = options.id.substring(2);
                    }

                    // Attempt to inspect the source code if we should.
                    if (inspector.shouldInspect(options)) {
                        inspector.inspect(options);
                    }

                    return options;
                };
            }()),
            makeRequire: function(basePath, context) {
                var require, extensionsReg = /\.[a-zA-Z]+$/, load;

                load = function(imports, fn) {
                    var promise, importer, importerPromise;

                    promise = lib.makePromise();
                    importer = lib.define.makeImporter("", basePath, imports, {}, context);
                    importerPromise = importer.run();

                    importerPromise.complete(function(imports) {
                        try {
                            imports.callFactory(fn);
                            promise.resolve();
                        } catch (error) {
                            promise.smash(error);
                        }
                    });
                    importerPromise.error(function(value) {
                        promise.smash(value);

                        lib.util.defer(function() {
                            if (typeof errorCallback === "function") {
                                errorCallback(value);
                            } else {
                                throw value;
                            }
                        });
                    });

                    return promise;
                };

                require = function() {
                    // require([dependencies], callback)
                    if (lib.util.isArray(arguments[0])) {
                        if (typeof arguments[1] === "function") {
                            load(arguments[0], arguments[1]);
                        } else {
                            throw new Error("TypeError: Expected a callback function.");
                        }
                        return;
                    // require(moduleId)
                    } else if (typeof arguments[0] === "string") {
                        if (arguments[0] === "require") {
                            return lib.define.makeRequire(basePath, context);
                        }

                        if (!context.contains(arguments[0])) throw new Error("Module does not exist: " + arguments[0]);
                        return context.get(arguments[0]);
                    }

                    throw new Error("TypeError: Expected a module ID.");
                };
                require.toUrl = function(resource) {
                    var ext, resourceId, url;

                    if (typeof resource === "string" && extensionsReg.test(resource)) {
                        // Retrieve and remove the extension.
                        ext = resource.match(extensionsReg).pop();
                        resource = resource.replace(extensionsReg, "");
                        // Make a resourceId.
                        resourceId = lib.resource.makeResourceId(resource, context);
                        // Convert to a URL with our extension set as the default.
                        // Truncate any url args if necessary.
                        return resourceId.toUrl(basePath, ext).split("?").shift();
                    }

                    throw new Error("TypeError: Expected a module ID of the form 'module-id.extension'.");
                };

                return require;
            },
            makeImporter: function(moduleId, basePath, imports, exports, context) {
                var qualifiedImports, promise, running, makeImports, makeScriptLoader, makeFinishedImports, isCircular;

                ///////////////////////
                // Private Functions //
                ///////////////////////

                // Define a maker that normalizes our imports.
                makeImports = (function() {
                    var normalizeImports;

                    // Normalizes the imports so the imports will be an object
                    // whose keys are valid identifiers and values are resource ID collections.
                    normalizeImports = function(imports) {
                        if (!imports) return [];

                        // Imports is an array.
                        if (lib.util.isArray(imports)) {
                            imports = (function() {
                                var i, resourceId;

                                i = imports.length;

                                while (i--) {
                                    imports[i] = lib.resource.makeResourceId(imports[i], context);
                                }

                                return imports;
                            }());
                        // Imports is an object.
                        } else {
                            imports = (function() {
                                var o, key;

                                o = {};
                                for (key in imports) {
                                    o[key] = lib.resource.makeResourceId(imports[key], context);
                                }

                                return o;
                            }());
                        }

                        return imports;
                    };

                    return function(imports) {
                        return normalizeImports(imports);
                    }
                }());

                // Define a maker that makes a loader for a script resource.
                makeScriptLoader = function(key, resourceId) {
                    var timeoutId, promise, cleanUp, load, resource, url;

                    promise = lib.makePromise();

                    // Handle CommonJS dependencies according to the AMD spec.
                    if (key === "exports" || resourceId.toString() === "exports") {
                        qualifiedImports[key] = qualifiedImports.exports = exports;
                        promise.resolve();
                        return promise.promise();
                    } else if (key === "require" || resourceId.toString() === "require") {
                        qualifiedImports[key] = qualifiedImports.require = lib.define.makeRequire(basePath, context);
                        promise.resolve();
                        return promise.promise();
                    } else if (key === "module" || resourceId.toString() === "module") {
                        // This will have to be filled in later.
                        qualifiedImports[key] = qualifiedImports.module = {id: ""};
                        promise.resolve();
                        return promise.promise();
                    }

                    timeoutId = setTimeout(function() {
                        promise.smash(new Error("Failed to load module due to timeout: " + url));
                    }, context.config.timeout);

                    cleanUp = function(script) {
                        clearTimeout(timeoutId);

                        if (script) {
                            script.onreadystatechange = null;
                            script.onload = null;
                            script.onerror = null;
                            script.onabort = null;
                        }
                    };

                    resource = resourceId.toString();
                    url = resourceId.toUrl(basePath);

                    load = function() {
                        var script, head, onload;

                        script = document.createElement("script");
                        script.type = "text/javascript";

                        context[url] = promise;

                        onload = function() {
                            var run, futureImportedValue;

                            cleanUp(script);

                            run = queue.dequeue();
                            futureImportedValue = run(context, resource, resourceId.toPath(), url);

                            futureImportedValue.complete(function(im) {
                                delete context[url];

                                // Cache the imported value and set its alias.
                                context.set(resource, im.value);
                                if (im.id) context.alias(resource, im.id);

                                qualifiedImports[key] = im.value;
                                promise.resolve(im);
                            });

                            futureImportedValue.error(function(value) {
                                promise.error(value);
                            });
                        };

                        script.onload = onload;
                        script.onreadystatechange = function() {
                            if (script.readyState === "complete" || script.readyState === "loaded") {
                                onload();
                            }
                        };

                        script.onerror = function() {
                            cleanUp(script);
                            promise.smash(new Error("Failed to load module: " + url));
                        };
                        script.onabort = function() {
                            cleanUp(script);
                            promise.smash(new Error("Failed to load module: " + url));
                        };
                        script.src = url;

                        head = document.getElementsByTagName("head")[0];
                        if (head) head.appendChild(script);
                    };

                    // MODULE ALREADY LOADED/DEFINED
                    if (context.contains(moduleId)) {
                        console.log("MODULE LOADED AND READING FROM CACHE: ", moduleId);
                        cleanUp();
                        qualifiedImports[key] = context.get(moduleId);
                        promise.resolve();
                    // LOADING MODULE DETECTED
                    } else if (url in context) {
                        console.log("CYCLIC DEP DETECTED: ", url, " ", resource, " module ID:", moduleId);
                        cleanUp();
                        qualifiedImports[key] = undefined;
                        promise.resolve();
                    // EMBEDDED SCRIPT DETECTED
                    } else if (resource in context) {
                        if (isCircular(resource)) {
                            cleanUp();
                            qualifiedImports[key] = undefined;
                            promise.resolve();
                        } else {
                            context[resource].complete(function(im) {
                                cleanUp();
                                qualifiedImports[key] = im.value;
                                promise.resolve(im);
                            });
                            context[resource].error(function(value) {
                                cleanUp();
                                promise.smash(value);
                            });
                        }
                    } else {
                        // Force the load to occur in the correct sequence in IE.
                        lib.util.defer(load);
                    }

                    return promise.promise();
                };

                makeFinishedImports = function() {
                    if (lib.util.isArray(imports)) {
                        qualifiedImports.length = imports.length;

                        return {
                            qualifiedImports: qualifiedImports,
                            exports: function() {
                                return qualifiedImports.exports;
                            },
                            module: function() {
                                return qualifiedImports.module;
                            },
                            require: function(value) {
                                return qualifiedImports.require;
                            },
                            callFactory: function(fn) {
                                var args = Array.prototype.slice.call(qualifiedImports);
                                return fn.apply(undefined, args);
                            }
                        };
                    }

                    return {
                        qualifiedImports: qualifiedImports,
                        exports: function(value) {
                            return qualifiedImports.exports;
                        },
                        module: function(value) {
                            return qualifiedImports.module;
                        },
                        require: function(value) {
                            return qualifiedImports.require;
                        },
                        callFactory: function(fn) {
                            return fn.call(undefined, qualifiedImports);
                        }
                    }
                };

                isCircular = function(resource) {
                    var promise, imports, key;

                    if (resource !== moduleId && resource in context) {
                        promise = context[resource];
                        imports = promise.imports;

                        if (promise.status() !== "unresolved") {
                            return false;
                        }

                        for (key in imports) {
                            if (imports[key].toString() === moduleId) return true;
                        }

                        for (key in imports) {
                            if (isCircular(imports[key].toString())) return true;
                        }
                    }

                    return false;
                };

                promise = lib.makePromise();
                qualifiedImports = {};
                imports = makeImports(imports);
                running = false;

                return {
                    run: function() {
                        if (running) return promise.promise();
                        running = true;

                        var promiseCol, key, dummyPromise;

                        promiseCol = lib.makePromiseCollection();
                        dummyPromise = lib.makePromise();
                        promiseCol.add(dummyPromise);

                        for (key in imports) {
                            promiseCol.add(makeScriptLoader(key, imports[key]));
                        }

                        promiseCol.complete(function() {
                            promise.resolve(makeFinishedImports());
                        });
                        promiseCol.error(function(value) {
                            promise.smash(value);
                        });
                        dummyPromise.resolve();

                        return promise.promise();
                    }
                }
            }
        }
    };

    makeDefine = function(context) {
        var define;

        define = function(options) {
            var promise, embeddedPromise, exports, run;

            options = lib.define.makeOptions.apply(undefined, arguments);

            // Create an exports object if 'exports' is in our imports.
            exports = lib.util.arrayIndexOf(options.imports, "exports") >= 0 ? {} : null;
            promise = lib.makePromise();
            embeddedPromise = lib.makePromise();
            // Put our embedded promise  on the context so defines in the same embedded script
            // will be deferred based on this promise.
            if (options.id) {
                embeddedPromise.imports = options.imports;
                context[options.id] = embeddedPromise;
            }

            run = function(ctx, moduleId, path, url) {
                var importer, importerPromise;

                // If we are the global define and the context on the promise is not equal to our own, then
                // this means that we are being loaded into the context on the promise and we must
                // paramaterize the context on the promise.
                if (define === globalDefine && ctx && ctx !== context) {
                    // Remove our embedded promise (any modules dependent on this will timeout).
                    embeddedPromise = null;
                    delete context[options.id];
                // Parameterize our own context and resolve the embedded promse with our actual promise.
                } else {
                    ctx = context;
                    embeddedPromise.resolve(promise);
                }

                moduleId = options.id || (moduleId || "");
                importer = lib.define.makeImporter(moduleId, path, options.imports, exports, ctx);
                importerPromise = importer.run();

                if (exports) ctx.set(moduleId, exports);

                // Go ahead and import our dependencies.
                importerPromise.complete(function(imports) {
                    var result;

                    // Fill out the CommonJS module object.
                    if (imports.module()) {
                        imports.module().id = moduleId;
                        imports.module().uri = url;
                    }

                    // Give the require it's main property according to CommonJS spec.
                    if (imports.require()) imports.require().main = {id: moduleId, uri: url};

                    if (typeof options.module === "function") {
                        try {
                            result = imports.callFactory(options.module);

                            if (imports.exports()) {
                                promise.resolve({id: options.id, value: imports.exports()});
                            } else {
                                promise.resolve({id: options.id, value: result});
                            }
                        } catch (error) {
                            promise.smash(error);

                            if (typeof errorCallback === "function") {
                                errorCallback(error);
                            } else {
                                throw error;
                            }
                        }
                    } else {
                        promise.resolve({id: options.id, value: options.module});
                    }
                });
                importerPromise.error(function(value) {
                    promise.smash(value);

                    lib.util.defer(function() {
                        if (typeof errorCallback === "function") {
                            errorCallback(value);
                        } else {
                            throw value;
                        }
                    });
                });

                return promise;
            };

            queue.enqueue(run);

            lib.util.defer(function() {
                // Embedded script detected.
                if (queue.contains(run)) {
                    var q = queue.slice();
                    queue.clear();

                    while (q.length) {
                        q.shift()(null, "", "", "");
                    }
                }
            });
        };
        define.config = function(value) {
            if (arguments.length) {
                var cfg = lib.define.makeConfig(value);

                // Copy only the changed values.
                for (var k in value) {
                    if (value.hasOwnProperty(k)) {
                        context.config[k] = cfg[k];
                    }
                }
            }

            return context.config;
        };
        define.context = function(config) {
            var ctx = lib.define.makeContext();
            ctx.config = lib.define.makeConfig(config);
            return {define: makeDefine(ctx)};
        };
        define.error = function(callback) {
            errorCallback = callback;
        };
        define.amd = {
            plugins: false,
            pluginDynamic: false,
            multiversion: true,
            defaultDeps: false,
            depsAsObject: true
        };

        // Save a reference to this define if it's our first time creating one.
        if (!globalDefine) globalDefine = define;

        return define;
    };


    return (function() {
        var ctx = lib.define.makeContext();
        ctx.config = lib.define.makeConfig();
        return makeDefine(ctx);
    }());
}(document));