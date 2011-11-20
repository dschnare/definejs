var define = (function(document, window, setTimeout, clearTimeout) {
    if (window.define) return window.define;

    ///////////////////////////
    // Cross Browser Logging //
    ///////////////////////////
    function log() {
        // Turn off logging when in production mode.
        if (log.prod) return;

        var i, len, arg, br, text, space, container, frag;

        container = log.getContainer() || log.buffer;
        frag = document.createDocumentFragment();
        space = function() { return document.createTextNode(" "); };
        br = function() { return document.createElement("br"); };
        text = function(text) { return document.createTextNode(text + ""); };
        len = arguments.length;

        if (container !== log.buffer && log.buffer) {
            container.appendChild(log.buffer);
            log.buffer = null;
        }

        for (i = 0; i < len; i++) {
            frag.appendChild(text(arguments[i]));
            frag.appendChild(space());
        }

        frag.appendChild(br());
        container.appendChild(frag);

        log.defer();
    }
    log.prod = false;
    log.buffer = document.createDocumentFragment();
    log.defer = function() {
        var container = log.getContainer();

        if (!container) {
            setTimeout(log.defer, 0);
        } else if (log.buffer) {
            container.appendChild(log.buffer);
            log.buffer = null;
        }
    };
    log.getContainer = function() {
        return document.body;
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
        },
        object: {
            create: function(o) {
                function F() {}
                F.prototype = o;
                return new F();
            }
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
        queue.dequeue = function() {
        	return this.shift();
       	},
        queue.clear = function() {
            while (this.length) this.pop();
        };

        return queue;
    }());

    function makePromise() {
        var waiting = [], dreading = [], status = "unresolved", value;

        function trigger() {
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
                if (status !== "unresolved") throw new Error("Cannot resolve a promise that is already resolved.");
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
        var moduleExports = {};

        return {
            saveModuleExports: function(moduleId, exports) {
                moduleExports[moduleId] = exports;
            },
            removeModuleExports: function(moduleId) {
                delete moduleExports[moduleId];
            },
            getModuleExports: function(moduleId) {
                return moduleExports[moduleId];
            },
            containsModuleExports: function(moduleId) {
                return moduleId in moduleExports;
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

        // Copy all remaining, potentially custom properties into the config.
        for (key in o) {
            if (!(key in config)) config[key] = o[key];
        }

        return config;
    }
    makeConfig.immutable = function(config) {
        config = util.object.create(config);

        if (config.paths) {
            config.paths = util.object.create(config.paths);
        }

        return config;
    };

    // Loads a JavaScript file by using a <script> element.
    // onComplete will be called with the URL of the script when the script has loaded.
    // onError will be called with an error message if the script fails to load.
    function loadScript(url, timeout, onComplete, onError) {
        var script = document.createElement("script"), id;

        script.onload = function() {
            clearTimeout(id);

            script.onload = null;
            script.onreadystatechange = null;
            script.onerror = null;

            if (util.isFunction(onComplete)) onComplete(url);
        };
        script.onreadystatechange = function() {
            if (script.readyState === "complete" || script.readyState === "loaded") {
                script.onload();
            }
        };
        script.onerror = function() {
            clearTimeout(id);

            script.onload = null;
            script.onreadystatechange = null;
            script.onerror = null;

            if (util.isFunction(onError)) onError(new Error("Failed to load script: " + url));
        };

        id = setTimeout(function() {
            script.onload = function() {};
            if (util.isFunction(onError)) onError(new Error("Failed to load script '" + url + "' due to timeout (" + timeout + "ms)."));
        }, timeout);

        script.src = url;
        document.getElementsByTagName("head")[0].appendChild(script);
    }
    
    // Determines if a module ID is valid.
    function isModuleIdValid(moduleId) {
    	var key, chars, char, validCharsRegExp, fileExtensionLikeRegExp, emptyTermExp;
    	
    	validCharsRegExp = isModuleIdValid.VALID_CHARS_REGEXP;
    	fileExtensionLikeRegExp = isModuleIdValid.FILE_EXTENSION_LIKE_REGEXP;
    	emptyTermRegExp = isModuleIdValid.EMPTY_TERM_REGEXP;
    	chars = moduleId.split("");
    	
    	for (key in chars) {
    		char = chars[key];
    		
    		if (typeof char !== "string") continue;
    		
    		if (!validCharsRegExp.test(char)) return false;
    	}
    	
    	// Module ID contains a file extension-like pattern.
    	if (moduleId.search(fileExtensionLikeRegExp) > 0) return false;
    	
    	// Module ID contains an empty term.
    	if (module.search(emptyTermRegExp) >= 0) return false;
    	
    	return true;
    }
    isModuleIdValid.VALID_CHARS_REGEXP = /[a-z0-9_\/\.]/i;
    isModuleIdValid.FILE_EXTENSION_LIKE_REGEXP = /.[^\/]/;
    isModuleIdValid.EMPTY_TERM_REGEXP = /\/\//;
    
    // Resolve a module ID relative to the specified relative ID. If module ID is not relative, then returns module ID unchanged.
    function resolveModuleId(moduleId, relativeModuleId) {
        if (moduleId.substring(0, 2) === "./") {
            moduleId = (relativeModuleId ? "/" : "") + moduleId.substring(2);
        } else if (moduleId.substring(0, 3) === "../") {
           	moduleId = (function() {
            	var rel, segments;
            		
            	segments = relativeModulid.split("/");
	            segments.pop();
	                
    	        rel = segments.join("/") + (segments.length ? "/" : "");
        	    return rel + moduleId.substring(3);
            }());
        }
        
        return moduleId;
    }

    // Convert a module ID into a qualified URL.
    function toUrl(moduleId, relativeModuleId, baseUrl, paths, urlArgs, ext) {
        var key, url = '';

        // If no extension is specified then assume '.js'.
        ext = ext || ".js";
        
        moduleId = resolveModuleId(moduleId, relativeModuleId);
        
        // Expand path aliases.
        for (key in paths) {
        	if (moduleId.indexOf(key) === 0) {
        		moduleId = moduleId.replace(key, paths[key]);
        		break;
        	}
        }

        // If the moduleId is absolute or has an extension then we simply return it as is.
        if ((/^\/|^[a-z]+:/i).test(moduleId) || (/\.[a-z0-9_]+$/i).test(moduleId)) return moduleId;

        // Prepend the baseUrl.
        url =  baseUrl + moduleId;

        // Append the extesion.
        url += ext;

        // Append any url arguments.
        url += urlArgs;

        return url;
    }

	// Determines if moduleId has a circular dependency on currentModuleId.
    function isCircular(moduleId, currentModuleId, context) {
        var o;

        if (moduleId in context) {
            if (moduleId !== currentModuleId) {
                o = context[moduleId];

                if (o.promise.isResolved()) return false;

                if (o.dependencies.contains(currentModuleId)) return true;

                o.dependencies.forEach(function(k, dep) {
                    if (isCircular(dep, currentModuleId, context)) return true;
                });
            }
        }

        return false;
    }

	// Creates a CommonJS 'require' function.
    function makeRequire(relativeModuleId, context, onError) {
        require = function() {
            // require([dependencies], callback)
            if (util.isArray(arguments[0])) {
                if (util.isFunction(arguments[1])) {
                    (function(args) {
                        var deps = args[0], count = deps.length, fn = args[1], imports = [], key;

                        function onComplete(key, xprts) {
                            if (count) imports[key] = xprts;

                            if (--count === 0) fn.apply(undefined, imports);
                        }

                        for (key in deps) {
                            if (typeof deps[key] === "function") continue;

                            loadModule(context, deps[key], relativeModuleId, (function(key) {
                                return function(xprts) {
                                    onComplete(key, xprts);
                                };
                            }(key)), onError);
                        }
                    }(arguments));
                } else {
                    throw new Error("TypeError: Expected a callback function.");
                }

                return;
            // require(moduleId)
            } else if (util.isString(arguments[0])) {
                switch (arguments[0]) {
                    case "require":
                        return makeRequire(relativeModuleId, context, onError);
                    case "config":
                        return makeConfig.immutable(context.config);
                }

                if (!context.containsModuleExports(arguments[0])) throw new Error("Module has not been exported into context: " + arguments[0]);
                return context.getModuleExports(arguments[0]);
            }

            throw new Error("TypeError: Expected a module ID.");
        };
        require.toUrl = (function() {
        	var EXTENSION_REGEXP = /\.[a-zA-Z0-9_]+$/;
        	
        	function(resource) {
    	        var ext, moduleId, config = context.config;

	            if (util.isString(resource) && (EXTENSION_REGEXP).test(resource)) {
            	    // Retrieve and remove the extension.
        	        ext = resource.match(EXTENSION_REGEXP).pop();
    	            moduleId = resource.replace(EXTENSION_REGEXP, "");
	                // Convert to a URL but be sure to preserve the original extension and specify no URL args.
                	return toUrl(moduleId, relativeModuleId, config.baseUrl, config.paths, "", ext);
            	}

            	throw new Error("TypeError: Expected a module ID of the form 'module-id.extension'.");
        	};
        }());

        return require;
    }

    // Loads an AMD module by using a <script> element.
    // onComplete is called with the module exports if the module has successfully loaded.
    // onError will be called with an error message if the module or any of its
    // dependencies has failed to load.
    function loadModule(context, moduleId, relativeModuleId, basePath, onComplete, onError) {
        var resolvedModuleId, moduleUrl, config, promise;

        onComplete = (function(fn) {
            return function(exports) {
                if (util.isFunction(fn)) fn(exports);
            };
        }(onComplete));

        onError = (function(fn) {
            return function(error) {
                if (util.isFunction(fn)) fn(error);
            };
        }(onError));

        config = context.config;
        moduleUrl = toUrl(moduleId, relativeModuleId, config.baseUrl, config.paths, config.urlArgs);

        // if the module is 'exported' then we complete with the exports
        if (context.containsModuleExports(moduleId)) {
            onComplete(context.getModuleExports(moduleId));

        // else the module is 'importing' and it's circular then we complete with undefined, otherwise wait for its exports
        } else if (moduleId in context) {
            if (isCircular(moduleId, relativeModuleId, context)) {
                onComplete(undefined);
            } else {
                context[moduleId].promise.done(onComplete);
                context[moduleId].promise.fail(onError);
            }

        // else the module is 'loading' already then we listen to its promise
        } else if (moduleUrl in context) {
            context[moduleUrl].done(onComplete);
            context[moduleUrl].fail(onError);

        // else we load
        } else {
            // Define the module as 'loading'.
            context[moduleUrl] = promise = makePromise();

            // Load the script that has the module definition.
            loadScript(moduleUrl, config.timeout, function() {
                // Clear the 'loading' status of the module.
                delete context[moduleUrl];

                // Import the module's dependencies.
                // pass the following: context, moduleId, moduleUrl
                queue.dequeue()(context, moduleId, moduleUrl, function(exports) {
                    onComplete(exports);
                    promise.resolve(exports);
                }, function(error) {
                    onError(error);
                    promise.error(error);
                });
            }, function(error) {
                delete context[moduleUrl];
                onError(error);
            });
        }
    }

    function makeDependencies(dependencies) {
        dependencies = util.isArray(dependencies) ? dependencies.slice() : [];
        
        var count = dependencies.length;
        
        dependencies.count = function() {
        	return count;
        };
        
        dependencies.forEach = function(fn) {
        	for (var key in this) {
        		if (typeof this[key] === "function") continue;
        		fn.call(undefined, key, this[key]);
        	}
        };
        
        dependencies.remove = function(index) {
        	if (index in this) {
        		delete this[index];
        		count -= 1;
        	}
        };
        
        dependencies.contains = function(moduleId) {        	
            for (var key in this) {
                if (typeof this[key] === "function") continue;
                if (this[key] === moduleId) return true;
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
            importCommonJsExports: function(dependencies) {
                // Look for CommonJS exports dependency and import it.
                dependencies.forEach(function(key, dep) {
                    switch (dep) {
                        case "exports":
                            importedValues[key] = commonJs.exports = {};
                            dependencies.remove(key);
                            break;
                    }
                });

                return commonJs.exports;
            },
            importCommonJs: function(moduleId, moduleUrl, context, dependencies) {
                // Look for CommonJS dependencies and import them.
                dependencies.forEach(function(key, dep) {
                    switch (dep) {
                        case "require":
                            importedValues[key] = commonJs.require = makeRequire(moduleId, context, null /*TODO: onError*/);
                            commonJs.require.main = {id: moduleId, uri: moduleUrl};
                            dependencies.remove(key);
                            break;
                        case "module":
                            importedValues[key] = commonJs.module = {id: moduleId, uri: moduleUrl};
                            dependencies.remove(key);
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

    function inspectFunctionForDependencies(factory) {
        var script, args, arg, i, len, reg, result, deps = [];

        script = factory.toString();
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
                        deps.push(arg);
                        break;
                    default:
                        throw new Error("Unrecognized dependency '" + arg + "' in script: " + script);
                }
            }
        }

        reg = /require\(('|")(.+?)\1\)/g;
        result = reg.exec(script);

        while (result) {
            deps.push(result[2]);
            result = reg.exec(script);
        }

        return deps;
    }

    function makeOptions(args) {
        var o, options = {
            moduleId: "",
            dependencies: makeDependencies()
        };

        // id?, dependencies?, fn
        if (args.length > 1) {
        	var id, deps, factory;
        	
        	id = util.isString(args[0]) ? args.shift() + "" : "";
        	deps = util.isArray(args[0]) ? args.shift() : [];
        	factory = args.pop();
        	
        	if (!util.isFunction(factory)) {
        		throw new Error("Expected a module factory function, instead got '" + factory + "'.");
        	}
        
            options.moduleId = id;
            
            options.factory = function(imports, commJsExports) {
                var result;

                if (util.isArray(imports)) {
                    result = factory.apply(undefined, imports);
                } else {
                    result = factory.call(undefined, imports);
                }

                return commJsExports || result;
            };
            
            options.dependencies = makeDependencies(deps);

            if (options.dependencies.count() === 0) {
                options.dependencies = makeDependencies(inspectFunctionForDependencies(factory));
            }
        // moduleValue
        } else {
            options.factory = (function(fn) {
                return function(imports, commJsExports) {
                    var result;

                    if (util.isFunction(fn)) {
                        if (util.isArray(imports)) {
                            result = fn.apply(undefined, imports);
                        } else {
                            result = fn.call(undefined, imports);
                        }

                        return commJsExports || result;
                    }

					// Return 'fn' (i.e. the module value).
                    return fn;
                };
            }(args.pop()));
        }

        return options;
    }

    function makeDefine(context) {
        function define() {
            var options, dependencies, exports, imports, importingPromise;

			try {
            	options = makeOptions(Array.prototype.slice.call(arguments));
            } catch (error) {
            	globalErrorHandler.trigger(error);
            	// Exit.
            	return;
            }
            
            dependencies = options.dependencies;
            imports = makeImports(util.isArray(dependencies));
            exports = imports.importCommonJsExports(dependencies);
            importingPromise = makePromise();

            // Define the module as 'importing' if it is given an explicit ID.
            // This is used by modules that have an explicit ID so that circular dependencies can be detected.
            if (options.moduleId) {
            	if (isModuleIdValid(options.moduleId)) {        
	                // Test if the module already exists.
                	if (options.moduleId in context) {
            	        globalErrorHanlder.trigger("Module '" + options.moduleId + "' has already been defined.");
        	            // Exit.
    	                return;
	                } else {
                    	// Export this module if we have CommonJS exports (if they exist) so that calls to require() can retrieve them.
                	    if (exports) {
            	            context.saveModuleExports(options.moduleId, exports);

        	            // Otherwise if no CommonJS exports exist then we save a promise and our dependencies
    	                // on the context so that circular dependencies can be detected. This marks the module as 'importing'.
	                    } else {
                        	context[options.moduleId] = {promise: importingPromise, dependencies: dependencies};
                    	}
                	}
                } else {
                	globalErrorHandler.trigger(new Error("Invalid module ID: " + options.moduleId));
                	// Exit.
                	return;
                }
            }

            // Enqueue a function that will import our dependencies.
            // The context here will be our 'parent' context.
            queue.enqueue(function(parentContext, moduleId, moduleUrl, onComplete, onError) {
                var ctx;
                
                // use the explicit module ID or the module ID used to load this module.
                moduleId = options.moduleId || moduleId;

                // Override the onError callback so that it can be called immediately.
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
                // we load into our parent context. Transfer over the CommonJS exports as well if it exists.
                if (define === globalDefine) {
                    if (parentContext !== context) {
                        parentContext[moduleId] = context[moduleId];
                        delete context[moduleId];

                        // Exports will only be defined at this point if the module has 'exports' as a dependency (i.e. CommonJS exports).
                        if (exports) {
                            parentContext.saveModuleExports(moduleId, exports);
                            context.removeModuleExports(moduleId);
                        }
                    }

					// Make sure to use our 'parent' context to load into.
                    ctx = parentContext;

                // Else we are a customly created 'define' with its own context, so
                // we forcefully use our own context.
                } else {
                    ctx = context;
                }

                // If we don't have exports yet, then test if the module already exists.
                // We will only have exports at this point if 'exports' are a dependency.
                if (!exports && ctx.containsModuleExports(moduleId)) {
                    onError(new Error("Module '" + moduleId + "' has already been defined."));
                    // Exit.
                    return;
                }

                // Attempt to import the CommonJS dependencies (except for 'exports').
                try {
                    imports.importCommonJs(moduleId, moduleUrl, ctx, dependencies);
                } catch (error) {
                    onError(error);
                    // Exit.
                    return;
                }

                // Override the onComplete callback. We do it here so that we can read the proper
                // 'count' value from our dependencies after the CommonJS dependencies have been imported.
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
                                exports = options.factory(imports.valueOf(), exports);
                                ctx.saveModuleExports(moduleId, exports);

                                // Get rid of our 'importing' state for this module.
                                delete ctx[moduleId];

                                if (util.isFunction(fn)) fn(exports);
                                importingPromise.resolve(exports);
                            } catch (error) {
                                onError(error);
                            }
                        }
                    };
                }(onComplete));

                // Ensure that the module is exported immediately if we have 'exports' as a dependency.
                // Again, we'll only have exports at this point if CommonJS exports was a dependency.
                if (exports) {
                    context.saveModuleExports(moduleId, exports);
                } else {
                	// Define the module as 'importing'.
	                // This is used to detect circular dependencies.
                    ctx[moduleId] = {promise: importingPromise, dependencies: dependencies};
                }

                // Import our dependencies.
                if (dependencies.count()) {
                    dependencies.forEach(function(key, modId) {
                        loadModule(ctx, modId, moduleId, function(xprts) {
                            onComplete(key, xprts);
                        }, onError);
                    });
                } else {
                    onComplete();
                }
            }); // queue.enqueue(fn)

            // Set a timeout so that in the future we check for any remaining
            // 'import' callbacks on the queue. These callbacks will be from
            // embedded scripts on the HTML page. When we run these callbacks
            // we use our context so that they are imported into it. We also
            // specify an empty string for the moduleId and moduleUrl.
            setTimeout(function() {
                // Import the dependencies for all embedded modules.
                if (queue.length) {
                    queue.dequeue()(context, "", "");
                }
            }, 10);
        } // define()

        // Hook into the global error handler.
        define.error = globalErrorHandler.error;

        // Expose the crossbrowser log function.
        define.log = log;

        // Function to create a new context with its own configuration.
        define.context = function(config) {
            var context = makeContext();
            context.config = makeConfig(config);
            return {define: makeDefine(context)};
        };

        define.amd = {
            plugins: false,
            pluginDynamic: false,
            multiversion: true,
            defaultDeps: false
        };

        return define;
    }

    // Return and create our global 'define'.
    return globalDefine = (function() {
        var context, define, scripts, i, pattern, scriptText, o, main, config;

		// Grab all script elements.
        scripts = document.getElementsByTagName("script");
        i = scripts.length;
        pattern = /define.*?\.js$/;

		// Helper to execute script text in a secure manner.
        function executeScript(scriptText) {
            var f = new Function("window", "document", "alert", "console", scriptText);
            return f.call({});
        }

		// Iterate over all script elements to find the 'definejs' script.
		// Once found, we take the contents of the script element and execute it as a function.
		// The script contents should be a JSON object so the function can return the it as an object.
        while (i--) {
            if (pattern.test(scripts[i].src)) {
                scriptText = scripts[i].innerHTML;
                // Trim leading and trailing whitespace.
                scriptText = scriptText.replace(/^\s+|\s+$/g, "");
                scriptText = "return " + scriptText + ";";

                try {
                    o = executeScript(scriptText);
                    config = o ? o.config : null;
                    main = o ? o.main : null;
                } catch(e) {
                	var er = Error("An error occurred while parsing the JSON initialization object.");
                	er.nestedError = e;
                	throw er;
                }
                
                break;
            }
        }

		// Setup the context for the global define, but use the config object
		// from the JSON object (if defined).
        context = makeContext();
        context.config = makeConfig(config);
        define = makeDefine(context);

		// Import the 'main' application module if one is defined.
        if (main && typeof main === "string") {
            define([main], function(){});
        }

        return define;
    }());
}(document, window, setTimeout, clearTimeout));