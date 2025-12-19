"use client";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Container,
  createDataTableColumnHelper,
  createDataTableCommandHelper,
  DataTable,
  DataTableRowSelectionState,
  DataTablePaginationState,
  Heading,
  StatusBadge,
  useDataTable,
  Select,
  Label,
} from "@medusajs/ui";
import { ArrowPath, ArrowUpRightOnBox } from "@medusajs/icons";
import { useListSbProducts } from "../../hooks/query/use-retrieve-sb-product";
import { useCreateSbProduct } from "../../hooks/mutation/use-create-sb-product";
import { useBulkSyncSbProducts } from "../../hooks/mutation/use-bulk-sync-sb-products";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type SbProductRow = {
  id: string;
  status: string;
  name: string;
  storyblok_editor_url: string | null;
};

const columnHelper = createDataTableColumnHelper<SbProductRow>();

const columns = [
  columnHelper.select(),
  columnHelper.accessor("name", {
    header: "Product",
    cell: ({ row }) => (
      <Link to={`/products/${row.original.id}`}>
        <Label className="hover:underline hover:underline-offset-4 hover:cursor-pointer ">{row.original.name}</Label>
      </Link>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue, row }) => {
      const isActive = getValue() === "Synced";
      const { mutateAsync, isPending } = useCreateSbProduct();

      if (isActive) {
        return <StatusBadge color="green">{getValue()}</StatusBadge>;
      }

      return (
        <div className="flex gap-2">
          <StatusBadge color={"red"}>{getValue()}</StatusBadge>
          <Button
            variant="primary"
            size="small"
            onClick={async () => mutateAsync({ product_id: row.original.id })}
            isLoading={isPending}
          >
            <ArrowPath />
          </Button>
        </div>
      );
    },
  }),
  columnHelper.accessor("storyblok_editor_url", {
    header: "Storyblok Editor",
    cell: ({ getValue }) => {
      const url = getValue();

      if (url) {
        return (
          <a className="ml-0.5" href={url} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <ArrowUpRightOnBox /> Open in Storyblok
            </Button>
          </a>
        );
      }

      return null;
    },
  }),
];

const commandHelper = createDataTableCommandHelper();

const useCommands = () => {
  return [
    commandHelper.command({
      label: "Sync",
      shortcut: "S",
      action: async (selection) => {
        const selectedIds = Object.keys(selection);
        const bulkSync = useBulkSyncSbProducts();
        await bulkSync.mutateAsync({ product_ids: selectedIds });
      },
    }),
  ];
};

export const SbProductsTable = () => {
  const limit = PAGE_SIZE_OPTIONS[0];
  const bulkSync = useBulkSyncSbProducts();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageSize: limit,
    pageIndex: 0,
  });

  const offset = useMemo(() => pagination.pageIndex * pagination.pageSize, [pagination]);

  const { data, isLoading } = useListSbProducts({
    limit: pagination.pageSize,
    offset,
  });

  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({});
  const commands = useCommands();

  const rows: SbProductRow[] =
    data?.products?.map((product) => ({
      id: product.id,
      name: product.name,
      status: !!product.storyblok_editor_url ? "Synced" : "Not Synced",
      storyblok_editor_url: product.storyblok_editor_url,
    })) || [];

  const instance = useDataTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    rowCount: data?.count || 0,
    isLoading,
    commands,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
    },
  });

  return (
    <DataTable instance={instance} className="w-full">
      <DataTable.Toolbar className="flex justify-between items-center py-4">
        <div className="flex items-center gap-4">
          <Heading>Products</Heading>
          <div className="flex items-center gap-2">
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) =>
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: 0,
                  pageSize: Number(value),
                }))
              }
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <Select.Item className="flex items-center" key={size} value={String(size)}>
                    {size} <span className="ml-0.5 mr-1">rows</span>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>
        <Button onClick={() => bulkSync.mutate({ all: true })}>Sync all</Button>
      </DataTable.Toolbar>
      <DataTable.Table />
      <DataTable.CommandBar selectedLabel={(count) => `${count} selected`} />

      <DataTable.Pagination />
    </DataTable>
  );
};
