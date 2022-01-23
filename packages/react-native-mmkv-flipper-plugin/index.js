import { useEffect, useRef } from "react";
let FlipperModule;
try {
    FlipperModule = require("react-native-flipper");
}
catch {
    // noop
}
export const useMMKVFlipper = (instance) => {
    if (FlipperModule == null) {
        throw new Error("Please install the 'react-native-flipper' package in your project to use Flipper integration for 'react-native-mmkv'");
    }
    const { addPlugin } = FlipperModule;
    const connectionRef = useRef();
    useEffect(() => {
        addPlugin({
            getId: () => "rn-mmkv",
            onConnect(connection) {
                connectionRef.current = connection;
                const data = instance
                    .getAllKeys()
                    .reduce((acc, key) => ({ ...acc, [key]: instance.getString(key) }), {});
                connection.send("mmkv-data", data);
                instance.addOnValueChangedListener((key) => {
                    connectionRef.current?.send("mmkv-key", {
                        key,
                        value: instance.getString(key),
                    });
                });
                connection.receive("mmkv-remove-key", (key) => {
                    instance.delete(key);
                });
                connection.receive("mmkv-set", ({ key, value }) => {
                    instance.set(key, value);
                });
                connection.receive("mmkv-remove-all", () => {
                    instance.clearAll();
                });
            },
            onDisconnect() {
                connectionRef.current = undefined;
            },
            runInBackground: () => false,
        });
    }, [addPlugin, instance]);
};
