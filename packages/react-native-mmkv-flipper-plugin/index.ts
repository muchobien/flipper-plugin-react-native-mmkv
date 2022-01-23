import type { Flipper } from "react-native-flipper";
import type { MMKV } from "react-native-mmkv";
import { useEffect, useRef } from "react";
let FlipperModule: typeof import("react-native-flipper") | undefined;

try {
  FlipperModule = require("react-native-flipper");
} catch {
  // noop
}

export const useMMKVFlipper = (instance: MMKV) => {
  if (FlipperModule == null) {
    throw new Error(
      "Please install the 'react-native-flipper' package in your project to use Flipper integration for 'react-native-mmkv'"
    );
  }

  const { addPlugin } = FlipperModule;

  const connectionRef = useRef<Flipper.FlipperConnection>();

  useEffect(() => {
    addPlugin({
      getId: () => "rn-mmkv",
      onConnect(connection) {
        connectionRef.current = connection;

        const data = instance
          .getAllKeys()
          .reduce(
            (acc, key) => ({ ...acc, [key]: instance.getString(key) }),
            {} as Record<string, string | undefined>
          );

        connection.send("mmkv-data", data);

        instance.addOnValueChangedListener((key) => {
          connectionRef.current?.send("mmkv-key", {
            key,
            value: instance.getString(key),
          });
        });

        connection.receive("mmkv-remove-key", (key: string) => {
          instance.delete(key);
        });

        connection.receive(
          "mmkv-set",
          ({ key, value }: { key: string; value: string }) => {
            instance.set(key, value);
          }
        );

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
