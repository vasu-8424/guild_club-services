"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/avatar";
import type { UserRole } from "@/db/schema";
import type { IconProps } from "@phosphor-icons/react";

import { getTherapistNotesAction } from "@/lib/actions/admin-notes-actions";
import { logoutAction } from "@/lib/actions/auth-actions";
import { LogoutButton } from "./logout-button";

interface SidebarProps {
  role: UserRole;
  userName: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: (props: IconProps) => React.ReactNode;
  badge?: number | null;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [unreadNotesCount, setUnreadNotesCount] = React.useState<number>(0);

  React.useEffect(() => {
    if (role !== "therapist") return;

    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const res = await getTherapistNotesAction();
        if (res.success && isMounted) {
          setUnreadNotesCount(res.unreadCount || 0);
        }
      } catch {
        // silent
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [role, pathname]);

  const getNavSections = (userRole: UserRole): NavSection[] => {
    switch (userRole) {
      case "super_admin":
        return [
          {
            section: "Overview",
            items: [
              {
                title: "Dashboard",
                href: "/super-admin/dashboard",
                icon: Icons.Dashboard,
              },
            ],
          },
          {
            section: "Management",
            items: [
              {
                title: "Cases",
                href: "/admin/cases",
                icon: Icons.Cases,
              },
              {
                title: "Therapists",
                href: "/admin/therapists",
                icon: Icons.Therapists,
              },
              {
                title: "Rooms",
                href: "/admin/rooms",
                icon: Icons.Door,
              },
              {
                title: "Admins",
                href: "/super-admin/admins",
                icon: Icons.Admins,
              },
              {
                title: "Branches",
                href: "/admin/branches",
                icon: Icons.Door,
              },
              {
                title: "Notifications",
                href: "/notifications",
                icon: Icons.Alert,
              },
            ],
          },
          {
            section: "Insights",
            items: [
              {
                title: "Reports",
                href: "/super-admin/reports",
                icon: Icons.Reports,
              },
              {
                title: "Delivery & Quota",
                href: "/super-admin/notifications",
                icon: Icons.Analytics,
              },
            ],
          },
        ];

      case "admin":
        return [
          {
            section: "Navigation",
            items: [
              {
                title: "Dashboard",
                href: "/admin/dashboard",
                icon: Icons.Dashboard,
              },
              {
                title: "Therapists",
                href: "/admin/therapists",
                icon: Icons.Therapists,
              },
              {
                title: "Rooms",
                href: "/admin/rooms",
                icon: Icons.Door,
              },
              {
                title: "Cases",
                href: "/admin/cases",
                icon: Icons.Cases,
              },
              {
                title: "Notifications",
                href: "/notifications",
                icon: Icons.Alert,
              },
            ],
          },
        ];

      case "therapist":
        return [
          {
            section: "Practice",
            items: [
              {
                title: "Dashboard",
                href: "/therapist/dashboard",
                icon: Icons.Dashboard,
              },
              {
                title: "My Patients",
                href: "/therapist/cases",
                icon: Icons.Cases,
              },
              {
                title: "Notes from Admin",
                href: "/therapist/notes",
                icon: Icons.Envelope,
                badge: unreadNotesCount,
              },
              {
                title: "Profile",
                href: "/therapist/profile",
                icon: Icons.User,
              },
            ],
          },
        ];

      default:
        return [];
    }
  };

  const navSections = getNavSections(role);

  return (
    <>
      {/* Mobile Toggle Button (Floating) */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-12 w-12 items-center justify-center rounded-none bg-[#0B7A63] text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-[#0B7A63]"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <Icons.Close className="h-6 w-6" /> : <Icons.Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Backdrop for Mobile Drawer */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        data-testid="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-200 ease-in-out lg:static shrink-0 select-none",
          collapsed ? "w-18" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <Link
            href={
              role === "super_admin"
                ? "/super-admin/dashboard"
                : role === "admin"
                ? "/admin/dashboard"
                : "/therapist/dashboard"
            }
            className="flex items-center gap-2.5 overflow-hidden"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-[#0B7A63] text-white shadow-xs">
              <Icons.Analytics className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="font-semibold text-slate-900 tracking-tight text-sm block truncate">
                  Guild Club
                </span>
                <span className="block text-[11px] font-bold text-[#0B7A63] tracking-wider uppercase truncate">
                  Services
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <Icons.CaretRight className="h-4 w-4" />
            ) : (
              <Icons.CaretLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav
          data-testid="sidebar-nav"
          className="flex-1 space-y-6 overflow-y-auto px-2 py-4 no-scrollbar"
        >
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && (
                <h2 className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {section.section}
                </h2>
              )}
              <div className="space-y-0.5">
                {section.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={itemIdx}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        "group flex items-center text-xs font-semibold rounded-none transition-all duration-150 relative",
                        collapsed
                          ? "h-10 w-10 mx-auto justify-center"
                          : "px-3.5 py-2.5 justify-start gap-3",
                        isActive
                          ? "border-l-[3px] border-l-[#0B7A63] bg-[#0B7A63]/10 text-[#0B7A63] font-bold"
                          : "border-l-[3px] border-l-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-[#0B7A63]"
                            : "text-slate-400 group-hover:text-slate-600"
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                      {!collapsed && typeof item.badge === "number" && item.badge > 0 && (
                        <span
                          data-testid="unread-notes-badge"
                          className="ml-auto inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-[#0B7A63] text-white rounded-none min-w-4"
                        >
                          {item.badge}
                        </span>
                      )}
                      {collapsed && typeof item.badge === "number" && item.badge > 0 && (
                        <span className="absolute top-1 right-1 h-2 w-2 bg-[#0B7A63] rounded-none ring-1 ring-white" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Card at bottom of sidebar: Square Profile Avatar & Logout Action */}
        <div className="border-t border-slate-200 p-3 bg-slate-50/70">
          <div
            className={cn(
              "flex items-center gap-2",
              collapsed ? "flex-col justify-center" : "px-1 justify-between"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar
                name={userName || "GC"}
                size="sm"
                variant={role === "therapist" ? "brand" : "indigo"}
              />
              {!collapsed && (
                <div className="min-w-0 flex-1 truncate">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {userName || "User"}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium capitalize truncate">
                    {role.replace("_", " ")}
                  </p>
                </div>
              )}
            </div>

            {!collapsed ? (
              <LogoutButton
                role={role}
                testId="sidebar-logout-button"
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer rounded-none"
                label="Logout"
              />
            ) : (
              <div className="mt-1">
                <LogoutButton
                  role={role}
                  iconOnly={true}
                  testId="sidebar-logout-button-collapsed"
                  className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer rounded-none"
                />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
