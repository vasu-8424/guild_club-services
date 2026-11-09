import * as React from "react";
import { PageTitle } from "./title-context";
import type { CurrentUser } from "@/lib/session";

interface DashboardShellProps {
  user?: CurrentUser;
  title: string;
  children: React.ReactNode;
}

export function DashboardShell({
  title,
  children,
}: DashboardShellProps) {
  return (
    <>
      {title && <PageTitle title={title} />}
      {children}
    </>
  );
}
