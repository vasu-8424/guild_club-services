"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import type { UserRole } from "@/db/schema";
import { getRoleDashboardPath } from "@/lib/navigation";

interface CapacitorBackButtonProps {
  role?: UserRole;
}

export function CapacitorBackButton({ role }: CapacitorBackButtonProps) {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    let removeListener: (() => void) | undefined;

    App.addListener("backButton", ({ canGoBack }) => {
      // 1. On login page -> exit app directly
      if (pathname === "/login") {
        App.exitApp();
        return;
      }

      const dashboardPath = role ? getRoleDashboardPath(role) : "/login";
      const isDashboardRoot = pathname === dashboardPath;

      // 2. On dashboard root -> exit only when user confirms
      if (isDashboardRoot) {
        const confirmExit = window.confirm("Do you want to exit Guild Club Services?");
        if (confirmExit) {
          App.exitApp();
        }
        return;
      }

      // 3. Tab roots (non-dashboard tabs) -> navigate to dashboard
      const tabRoots = [
        "/therapist/cases",
        "/therapist/notes",
        "/admin/therapists",
        "/admin/cases",
        "/super-admin/branches",
        "/super-admin/admins",
        "/super-admin/reports",
        "/profile",
        "/therapist/profile",
      ];

      if (tabRoots.includes(pathname)) {
        router.push(dashboardPath);
        return;
      }

      // 4. On deep page -> go back in history if possible, else to dashboard
      if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        router.push(dashboardPath);
      }
    })
      .then((handle) => {
        removeListener = () => handle.remove();
      })
      .catch(() => {
        // Running in non-Capacitor environment (e.g. standard browser)
      });

    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, [pathname, role, router]);

  return null;
}

