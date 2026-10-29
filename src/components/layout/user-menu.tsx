"use client";

import * as React from "react";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth-actions";
import { LogoutButton } from "./logout-button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Icons } from "@/components/ui/icons";

interface UserMenuProps {
  user: {
    name: string;
    email: string;
    role: "super_admin" | "admin" | "therapist";
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRoleVariant = (role: string) => {
    switch (role) {
      case "super_admin":
        return "role_super_admin";
      case "admin":
        return "role_admin";
      case "therapist":
        return "role_therapist";
      default:
        return "default";
    }
  };

  const formatRole = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "admin":
        return "Clinic Admin";
      case "therapist":
        return "Therapist";
      default:
        return role;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        data-testid="user-menu-button"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 rounded-none p-1 text-sm transition-all duration-150 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A63] cursor-pointer"
        aria-expanded={isOpen}
      >
        <Avatar
          name={user.name}
          size="sm"
          variant={user.role === "therapist" ? "brand" : user.role === "admin" ? "indigo" : "slate"}
        />
        <div className="hidden text-left sm:block">
          <p className="text-xs font-semibold text-slate-800 leading-tight">
            {user.name}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            {formatRole(user.role)}
          </p>
        </div>
        <Icons.CaretDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
      </button>

      {isOpen && (
        <div
          data-testid="user-menu-dropdown"
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-none border border-slate-300 bg-white p-1.5 shadow-[0_4px_12px_rgba(15,23,42,0.08)] z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* User profile info header */}
          <div className="border-b border-slate-100 px-3 py-2.5 mb-1">
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-xs font-semibold text-slate-900 truncate">
                {user.name}
              </span>
              <Badge variant={getRoleVariant(user.role)}>
                {formatRole(user.role)}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>

          {/* Change Password Link */}
          <Link
            href="/change-password"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <Icons.Security className="h-3.5 w-3.5 text-slate-400" />
            <span>Change Password</span>
          </Link>

          {/* Session Indicator */}
          <div className="px-3 py-2 text-[11px] text-slate-500 font-medium flex items-center gap-2 border-t border-slate-100 mt-1">
            <Icons.Success className="h-3.5 w-3.5 text-emerald-600" />
            <span>Active Secure Session</span>
          </div>

          {/* Logout Action */}
          <div className="border-t border-slate-100 pt-1 mt-1">
            <LogoutButton role={user.role} testId="logout-button" />
          </div>
        </div>
      )}
    </div>
  );
}
