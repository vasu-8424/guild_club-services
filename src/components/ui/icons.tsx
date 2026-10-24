"use client";

import * as React from "react";
import {
  SquaresFour,
  ChartLineUp,
  ChartBar,
  Briefcase,
  Users,
  UsersThree,
  User,
  UserCheck,
  UserGear,
  ShieldCheck,
  CalendarBlank,
  Calendar,
  Clock,
  ClockCounterClockwise,
  CheckCircle,
  WarningCircle,
  HourglassMedium,
  TrendUp,
  TrendDown,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  DownloadSimple,
  Export,
  Plus,
  X,
  Check,
  Funnel,
  MagnifyingGlass,
  DotsThreeVertical,
  DotsThree,
  CaretDown,
  CaretUp,
  CaretRight,
  CaretLeft,
  Camera,
  Signature,
  PencilSimple,
  Trash,
  ArrowCounterClockwise,
  ArrowClockwise,
  SignOut,
  Gear,
  Buildings,
  Door,
  FileText,
  FileXls,
  FilePdf,
  Pulse,
  Eye,
  Info,
  CircleNotch,
  ListDashes,
  Sparkle,
  type IconProps,
} from "@phosphor-icons/react";

/**
 * Standard Phosphor Icon Weights:
 * - "duotone" for navigation, stat cards, and chart headers
 * - "bold" for buttons and compact actions
 */

export const Icons = {
  // Navigation & Primary Sections
  Dashboard: (props: IconProps) => <SquaresFour weight="duotone" size={20} {...props} />,
  Analytics: (props: IconProps) => <ChartLineUp weight="duotone" size={20} {...props} />,
  Cases: (props: IconProps) => <Briefcase weight="duotone" size={20} {...props} />,
  Therapists: (props: IconProps) => <UsersThree weight="duotone" size={20} {...props} />,
  Admins: (props: IconProps) => <UserGear weight="duotone" size={20} {...props} />,
  Security: (props: IconProps) => <ShieldCheck weight="duotone" size={20} {...props} />,
  Reports: (props: IconProps) => <ChartBar weight="duotone" size={20} {...props} />,
  Room: (props: IconProps) => <Door weight="duotone" size={20} {...props} />,
  Settings: (props: IconProps) => <Gear weight="duotone" size={20} {...props} />,
  SignOut: (props: IconProps) => <SignOut weight="duotone" size={20} {...props} />,

  // Stat Card & Metric Icons
  TotalCases: (props: IconProps) => <Briefcase weight="duotone" size={24} {...props} />,
  ActiveCases: (props: IconProps) => <Pulse weight="duotone" size={24} {...props} />,
  CompletedSessions: (props: IconProps) => <CheckCircle weight="duotone" size={24} {...props} />,
  ActiveTherapists: (props: IconProps) => <Users weight="duotone" size={24} {...props} />,
  UnassignedCases: (props: IconProps) => <ClockCounterClockwise weight="duotone" size={24} {...props} />,
  InProgressCases: (props: IconProps) => <HourglassMedium weight="duotone" size={24} {...props} />,
  SuccessRate: (props: IconProps) => <Sparkle weight="duotone" size={24} {...props} />,
  Capacity: (props: IconProps) => <UserCheck weight="duotone" size={24} {...props} />,

  // Functional & Button Icons (Bold by default for buttons)
  Add: (props: IconProps) => <Plus weight="bold" size={16} {...props} />,
  ArrowRight: (props: IconProps) => <ArrowRight weight="bold" size={16} {...props} />,
  ArrowLeft: (props: IconProps) => <ArrowLeft weight="bold" size={16} {...props} />,
  Download: (props: IconProps) => <DownloadSimple weight="bold" size={16} {...props} />,
  Export: (props: IconProps) => <Export weight="bold" size={16} {...props} />,
  Check: (props: IconProps) => <Check weight="bold" size={16} {...props} />,
  Close: (props: IconProps) => <X weight="bold" size={16} {...props} />,
  Search: (props: IconProps) => <MagnifyingGlass weight="bold" size={16} {...props} />,
  Filter: (props: IconProps) => <Funnel weight="bold" size={16} {...props} />,
  Menu: (props: IconProps) => <ListDashes weight="bold" size={16} {...props} />,
  Kebab: (props: IconProps) => <DotsThreeVertical weight="bold" size={16} {...props} />,
  CaretDown: (props: IconProps) => <CaretDown weight="bold" size={16} {...props} />,
  CaretUp: (props: IconProps) => <CaretUp weight="bold" size={16} {...props} />,
  CaretRight: (props: IconProps) => <CaretRight weight="bold" size={16} {...props} />,
  CaretLeft: (props: IconProps) => <CaretLeft weight="bold" size={16} {...props} />,

  // Trends & Status
  TrendUp: (props: IconProps) => <TrendUp weight="bold" size={16} {...props} />,
  TrendDown: (props: IconProps) => <TrendDown weight="bold" size={16} {...props} />,
  ArrowUp: (props: IconProps) => <ArrowUp weight="bold" size={16} {...props} />,
  ArrowDown: (props: IconProps) => <ArrowDown weight="bold" size={16} {...props} />,
  Warning: (props: IconProps) => <WarningCircle weight="duotone" size={18} {...props} />,
  Alert: (props: IconProps) => <WarningCircle weight="duotone" size={18} {...props} />,
  Info: (props: IconProps) => <Info weight="duotone" size={18} {...props} />,
  Success: (props: IconProps) => <CheckCircle weight="duotone" size={18} {...props} />,
  Clock: (props: IconProps) => <Clock weight="duotone" size={16} {...props} />,
  Calendar: (props: IconProps) => <CalendarBlank weight="duotone" size={16} {...props} />,

  // Clinical & Drawer
  Camera: (props: IconProps) => <Camera weight="duotone" size={18} {...props} />,
  Signature: (props: IconProps) => <Signature weight="duotone" size={18} {...props} />,
  Edit: (props: IconProps) => <PencilSimple weight="duotone" size={16} {...props} />,
  Trash: (props: IconProps) => <Trash weight="duotone" size={16} {...props} />,
  Undo: (props: IconProps) => <ArrowCounterClockwise weight="bold" size={16} {...props} />,
  Redo: (props: IconProps) => <ArrowClockwise weight="bold" size={16} {...props} />,
  View: (props: IconProps) => <Eye weight="duotone" size={16} {...props} />,
  FileText: (props: IconProps) => <FileText weight="duotone" size={18} {...props} />,
  FileExcel: (props: IconProps) => <FileXls weight="duotone" size={18} {...props} />,
  FilePdf: (props: IconProps) => <FilePdf weight="duotone" size={18} {...props} />,
  UserSingle: (props: IconProps) => <User weight="duotone" size={18} {...props} />,
  Spinner: (props: IconProps) => <CircleNotch weight="bold" size={16} className="animate-spin" {...props} />,
};

/**
 * Square Icon Tile (40px, 0 radius, tinted brand background, duotone icon in brand color)
 */
export interface IconTileProps {
  icon: React.ComponentType<IconProps>;
  color?: "teal" | "indigo" | "sky" | "amber" | "rose" | "slate" | "emerald";
  className?: string;
  size?: number;
}

export function IconTile({
  icon: IconComponent,
  color = "teal",
  className = "",
  size = 22,
}: IconTileProps) {
  const colorMap = {
    teal: "bg-[#0B7A63]/10 text-[#0B7A63] border-[#0B7A63]/20",
    indigo: "bg-[#4338CA]/10 text-[#4338CA] border-[#4338CA]/20",
    sky: "bg-[#0284C7]/10 text-[#0284C7] border-[#0284C7]/20",
    amber: "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20",
    rose: "bg-[#E11D48]/10 text-[#E11D48] border-[#E11D48]/20",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <div
      className={`h-10 w-10 shrink-0 rounded-none border flex items-center justify-center ${colorMap[color]} ${className}`}
    >
      <IconComponent weight="duotone" size={size} />
    </div>
  );
}

export type { IconProps };
