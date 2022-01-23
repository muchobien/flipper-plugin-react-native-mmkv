import React, { useCallback } from "react";
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
import { Button, Form, Input, Menu } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

type Data = Record<string, string>;

type Events = {
  "mmkv-remove-key": { key: string };
  "mmkv-data": Data;
  "mmkv-key": { key: string; value: string | undefined };
};

type SetParams = {
  id?: string;
  key: string;
  value: string;
};

type Methods = {
  "mmkv-remove-key": (key: string) => Promise<void>;
  "mmkv-remove-all": () => Promise<void>;
  "mmkv-set": (params: SetParams) => Promise<void>;
};

type Row = {
  id: string;
  key: string;
  value: string;
};

// Read more: https://fbflipper.com/docs/tutorial/js-custom#creating-a-first-plugin
// API: https://fbflipper.com/docs/extending/flipper-plugin#pluginclient
export function plugin(client: PluginClient<Events, Methods>) {
  const rows = createDataSource<Row, keyof Row>([], {
    persist: "rows",
    key: "id",
  });

  const selectedRow = createState<Row | undefined>(undefined, {
    persist: "selection",
  });

  client.onMessage("mmkv-data", (newData) => {
    Object.entries(newData).forEach(([key, value]) => {
      rows.upsert({ id: key, key, value });
    });
  });

  client.onMessage("mmkv-key", ({ key, value }) => {
    if (value) {
      rows.upsert({ id: key, key, value });
    } else {
      rows.deleteByKey(key);
    }
  });

  const removeKey = (key: string) => {
    rows.deleteByKey(key);
    selectedRow.set(undefined);
    client.send("mmkv-remove-key", key);
  };

  const removeAll = () => {
    rows.clear();
    selectedRow.set(undefined);
    client.send("mmkv-remove-all", undefined);
  };

  const set = (params: SetParams) => {
    const row = { id: params.key, key: params.key, value: params.value };
    rows.upsert(row);
    selectedRow.set(row);
    client.send("mmkv-set", params);
  };

  return { rows, selectedRow, removeKey, removeAll, set };
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
  record,
  onFinish,
}: {
  record?: T;
  onFinish: (params: T) => void;
}) {
  return (
    <DetailSidebar width={400}>
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
  const selectedRecord = useValue(instance.selectedRow);

  const handleSelect = useCallback(
    (row: Row | undefined) => {
      instance.selectedRow.set(row);
    },
    [instance.selectedRow]
  );

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
        <Sidebar record={selectedRecord} onFinish={instance.set} />
      </Layout.Container>
    </Layout.ScrollContainer>
  );
}
