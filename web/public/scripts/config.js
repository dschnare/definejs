//Map the configure({}) call to loader-specific call.
var config = function (o) {
        go = define.context(o).define;
    },

    //Map the top-level entry point to start loading to loader-specific call.
    go = define,

    //Indicate what levels of the API are implemented by this loader,
    //and therefore which tests to run.
    implemented = {
        basic: true,
        anon: true,
        funcString: true,
        require: true,
        plugins: false,
        pluginDynamic: false
    };


define.error(function (error) {
    console.log(error, error.stack);
});

//Remove the global require, to make sure a global require is not assumed
//in the tests
require = undefined;