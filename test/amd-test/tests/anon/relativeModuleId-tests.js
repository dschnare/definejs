config({
    paths: {
        "array": "impl/array"
    }
});

go(["require", "array"], function(require, array) {
        doh.register(
            "relativeModuleId",
            [
                function relativeModuleId(t){
                    t.is("impl/array", array.name);
                    t.is("impl/util", array.utilName);
                }
            ]
        );

        doh.run();
    }
);
