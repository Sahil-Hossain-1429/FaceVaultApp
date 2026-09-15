const { withMainApplication } = require("@expo/config-plugins");

module.exports = function withOnnxruntimePackage(config) {
    return withMainApplication(config, async (config) => {
        let { contents } = config.modResults;

        // Add the import BEFORE the class declaration
        if (!contents.includes("import ai.onnxruntime.reactnative.OnnxruntimePackage")) {
            // Find "class MainApplication" and add the import before it
            const classDeclaration = "class MainApplication : Application(), ReactApplication {";
            if (contents.includes(classDeclaration)) {
                contents = contents.replace(
                    classDeclaration,
                    "import ai.onnxruntime.reactnative.OnnxruntimePackage\n\n" + classDeclaration
                );
            }
        }

        // Add OnnxruntimePackage() to packages list if not already there
        if (!contents.includes("add(OnnxruntimePackage())")) {
            contents = contents.replace(
                "// add(MyReactNativePackage())",
                "// add(MyReactNativePackage())\n          add(OnnxruntimePackage())"
            );
        }

        config.modResults.contents = contents;
        return config;
    });
};