import type { Flipper } from "react-native-flipper";
import type { MMKV } from "react-native-mmkv";
let FlipperModule: typeof import("react-native-flipper") | undefined;

try {
  FlipperModule = require("react-native-flipper");
} catch {
  // noop
}

type MMKVInstances = Record<string, MMKV>;

type InstanceEntry = {
  key: string;
  value: string;
  instance: string;
};

let currentConnection: Flipper.FlipperConnection | null = null;

export const initializeMMKVFlipper = (instances: MMKVInstances) => {
  if (FlipperModule == null) {
    throw new Error(
      "Please install the 'react-native-flipper' package in your project to use Flipper integration for 'react-native-mmkv'"
    );
  }

  const { addPlugin } = FlipperModule;

  if (currentConnection === null) {
    addPlugin({
      getId: () => "rn-mmkv",
      onConnect(connection) {
        currentConnection = connection;
        const data = Object.entries(instances).reduce<
          Record<string, Record<string, string | null>>
        >(
          (instancesDict, [name, instance]) => ({
            ...instancesDict,
            [name]: instance
              .getAllKeys()
              .reduce<Record<string, string | null>>(
                (instanceDict, key) => ({
                  ...instanceDict,
                  [key]: instance.getString(key) ?? null,
                }),
                {}
              ),
          }),
          {}
        );

        connection.send("mmkv-data", data);

        Object.entries(instances).forEach(([name, instance]) => {
          instance.addOnValueChangedListener((key) => {
            currentConnection?.send("mmkv-key", {
              key,
              value: instance.getString(key),
              instance: name,
            });
          });
        });

        connection.receive(
          "mmkv-remove-key",
          ({ key, instance }: Omit<InstanceEntry, "value">) => {
            instances[instance].delete(key);
          }
        );

        connection.receive(
          "mmkv-set",
          ({ key, value, instance }: InstanceEntry) => {
            instances[instance].set(key, value);
          }
        );

        connection.receive("mmkv-remove-all", (instance: string) => {
          instances[instance].clearAll();
        });
      },
      onDisconnect() {
        currentConnection = null;
      },
      runInBackground: () => false,
    });
  }
};
