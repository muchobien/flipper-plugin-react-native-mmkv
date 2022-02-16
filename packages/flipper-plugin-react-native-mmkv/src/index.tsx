import React, { useCallback, useEffect, useMemo } from "react";
import {
  createDataSource,
  createState,
  DataInspector,
  DataTable,
  DataTableColumn,
  DetailSidebar,
  Layout,
  Panel,
  PluginClient,
  usePlugin,
  useValue,
} from "flipper-plugin";
import { Button, Form, Input, Menu, Select } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

type Data = Record<string, string>;

type Events = {
  "mmkv-remove-key": { key: string; instance: string };
  "mmkv-data": Record<string, Data>;
  "mmkv-key": { key: string; value: string | undefined; instance: string };
};

type SetParams = {
  key: string;
  value: string;
};

type Methods = {
  "mmkv-remove-key": (params: {
    key: string;
    instance: string;
  }) => Promise<void>;
  "mmkv-remove-all": (instance: string) => Promise<void>;
  "mmkv-set": (params: {
    key: string;
    value: string;
    instance: string;
  }) => Promise<void>;
};

type InstanceDict = Record<string, Data>;

type Row = {
  key: string;
  value: string;
};

// Read more: https://fbflipper.com/docs/tutorial/js-custom#creating-a-first-plugin
// API: https://fbflipper.com/docs/extending/flipper-plugin#pluginclient
export function plugin(client: PluginClient<Events, Methods>) {
  const rows = createDataSource<Row, keyof Row>([], {
    persist: "rows",
    key: "key",
  });
  const instances = createState<InstanceDict>({}, { persist: "instances" });
  const selectedInstance = createState<string | undefined>(undefined, {
    persist: "selectedInstance",
  });

  const selectedRow = createState<Row | undefined>(undefined, {
    persist: "selection",
  });

  client.onMessage("mmkv-data", (newData) => {
    Object.entries(newData).forEach(([name, instance]) => {
      instances.update((draft) => {
        draft[name] = instance;
      });
    });
  });

  client.onMessage("mmkv-key", ({ key, value, instance }) => {
    if (value) {
      instances.update((draft) => {
        draft[instance][key] = value;
      });
    } else {
      instances.update((draft) => {
        delete draft[instance][key];
      });
    }
  });

  const removeKey = (key: string) => {
    const instance = selectedInstance.get();
    if (instance) {
      selectedRow.set(undefined);
      instances.update((draft) => {
        delete draft[instance][key];
      });
      client.send("mmkv-remove-key", { key, instance });
    }
  };

  const removeAll = () => {
    const instance = selectedInstance.get();
    if (instance) {
      selectedRow.set(undefined);
      client.send("mmkv-remove-all", instance);
      instances.update((draft) => {
        delete draft[instance];
      });
      selectedInstance.set(undefined);
    }
  };

  const set = (params: SetParams) => {
    const instance = selectedInstance.get();
    if (instance) {
      client.send("mmkv-set", { ...params, instance });
      instances.update((draft) => {
        draft[instance][params.key] = params.value;
      });
      selectedRow.set(params);
    }
  };

  const updateRows = (update: Row[]) => {
    rows.clear();
    update.forEach((row) => {
      rows.upsert(row);
    });
  };

  return {
    instances,
    removeAll,
    removeKey,
    rows,
    selectedInstance,
    selectedRow,
    set,
    updateRows,
  };
}

const columns: DataTableColumn<Row>[] = [
  {
    key: "key",
    title: "Key",
    width: "10%",
  },
  {
    key: "value",
    title: "Value",
  },
];

const safeJSONParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

function Sidebar<T extends Row>({
  instances,
  record,
  onFinish,
  onInstanceChange,
}: {
  record?: T;
  instances: InstanceDict;
  onFinish: (params: T) => void;
  onInstanceChange: (instance: string) => void;
}) {
  return (
    <DetailSidebar width={400}>
      <Select
        showSearch
        placeholder="Select an instance"
        optionFilterProp="children"
        onChange={onInstanceChange}
        onSearch={onInstanceChange}
        filterOption={(input, option) =>
          (option?.children as unknown as string)
            ?.toLowerCase()
            .indexOf(input.toLowerCase()) >= 0
        }
      >
        {Object.keys(instances).map((instance) => (
          <Select.Option value="instance">{instance}</Select.Option>
        ))}
      </Select>
      {record && (
        <Panel title="Payload" collapsible={false} pad="huge">
          <DataInspector
            data={{
              key: record.key,
              value: safeJSONParse(record.value),
            }}
            expandRoot
          />
        </Panel>
      )}
      <Panel title={record ? "Edit" : "Add"} collapsible={false} pad="huge">
        <Form
          name="basic"
          layout="vertical"
          initialValues={record}
          autoComplete="off"
          onFinish={onFinish}
        >
          <Form.Item
            label="Key"
            name="key"
            hidden={!!record}
            rules={[
              {
                required: true,
                message: "Please input key!",
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Value"
            name="value"
            rules={[
              {
                required: true,
                message: "please input value!",
              },
            ]}
          >
            <Input.TextArea />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
              Submit
            </Button>
          </Form.Item>
        </Form>
      </Panel>
    </DetailSidebar>
  );
}

export function Component() {
  const instance = usePlugin(plugin);
  const selectedInstance = useValue(instance.selectedInstance);
  const selectedRecord = useValue(instance.selectedRow);

  const handleSelect = useCallback(
    (row: Row | undefined) => {
      instance.selectedRow.set(row);
    },
    [instance.selectedRow]
  );

  const handleInstanceChange = useCallback((ins: string) => {
    instance.selectedInstance.set(ins);
  }, []);

  useEffect(() => {
    const current = instance.instances.get();
    if (current && selectedInstance) {
      instance.updateRows(
        Object.entries(current[selectedInstance]).map(([key, value]) => ({
          key,
          value,
        }))
      );
    }
  }, [selectedInstance]);

  return (
    <Layout.ScrollContainer>
      <Layout.Container grow>
        <DataTable
          columns={columns}
          dataSource={instance.rows}
          onSelect={handleSelect}
          extraActions={
            <>
              <Button
                title="Add record"
                onClick={() => handleSelect(undefined)}
              >
                <PlusOutlined />
              </Button>
              <Button title="Clear records" onClick={instance.removeAll}>
                <DeleteOutlined />
              </Button>
            </>
          }
          onContextMenu={(record) => (
            <Menu.Item
              key="remove"
              icon={<DeleteOutlined />}
              onClick={() => {
                if (!record) return;
                instance.removeKey(record.key);
              }}
            >
              Remove
            </Menu.Item>
          )}
        />
        <Sidebar
          record={selectedRecord}
          onFinish={instance.set}
          instances={instance.instances.get()}
          onInstanceChange={handleInstanceChange}
        />
      </Layout.Container>
    </Layout.ScrollContainer>
  );
}
