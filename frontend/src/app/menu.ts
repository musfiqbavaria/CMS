import {
  FileText,
  Globe,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  ListTree,
  MonitorCheck,
  Palette,
  PlusCircle,
  ScrollText,
  Settings as SettingsIcon,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface MenuEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Phase that implements the page; undefined = implemented now. */
  phase?: number;
}

export interface MenuSection {
  title: string;
  items: MenuEntry[];
}

export const MENU: MenuSection[] = [
  {
    title: "Manage",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/websites", label: "Websites", icon: Globe, phase: 3 },
      { to: "/websites/new", label: "Add Website", icon: PlusCircle, phase: 3 },
    ],
  },
  {
    title: "Build",
    items: [
      { to: "/builder/pages", label: "Pages", icon: FileText, phase: 7 },
      { to: "/builder/sections", label: "Sections", icon: ListTree, phase: 7 },
      { to: "/builder/themes", label: "Themes", icon: Palette, phase: 7 },
      { to: "/builder/menus", label: "Menus", icon: ListTree, phase: 7 },
      { to: "/media", label: "Media Library", icon: Image, phase: 5 },
      { to: "/templates", label: "Templates", icon: LayoutTemplate, phase: 7 },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/monitoring", label: "Monitoring", icon: MonitorCheck, phase: 8 },
      { to: "/audit", label: "Audit Logs", icon: ScrollText, phase: 8 },
      { to: "/users", label: "Users & Roles", icon: Users, phase: 8 },
      { to: "/settings", label: "Settings", icon: SettingsIcon, phase: 8 },
    ],
  },
];

export const ALL_ENTRIES: MenuEntry[] = MENU.flatMap((s) => s.items);
