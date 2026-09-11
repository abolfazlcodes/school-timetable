import type { ReactNode } from "react";

export interface Column<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  className?: string;
}

export function DataTable<Row>({ columns, rows, getRowKey, caption }: { columns: Column<Row>[]; rows: Row[]; getRowKey: (row: Row) => string; caption: string }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{columns.map((column) => <th key={column.key} className={column.className} scope="col">{column.header}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={getRowKey(row)}>{columns.map((column) => <td key={column.key} className={column.className}>{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
