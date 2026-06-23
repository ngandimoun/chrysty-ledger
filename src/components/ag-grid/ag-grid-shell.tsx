"use client";

import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider, AgGridReact, type AgGridReactProps } from "ag-grid-react";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

const AG_GRID_MODULES = [AllCommunityModule];

type AgGridShellProps = AgGridReactProps;

export function AgGridShell({ theme = "legacy", ...props }: AgGridShellProps) {
  return (
    <AgGridProvider modules={AG_GRID_MODULES}>
      <AgGridReact theme={theme} {...props} />
    </AgGridProvider>
  );
}
