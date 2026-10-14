import {
  FileText,
  Globe,
  Hammer,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  ListTree,
  MonitorCheck,
  Newspaper,
  Palette,
  PlusCircle,
  ScrollText,
  Settings as SettingsIcon,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface MenuEntry {
  to: string;
  label: string;
  icon: LucideIcon;
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
      { to: "/websites", label: "Websites", icon: Globe },
      { to: "/websites/new", label: "Add Website", icon: PlusCircle },
    ],
  },
  {
    title: "Build",
    items: [
      { to: "/builder/new", label: "Build Website", icon: Hammer },
      { to: "/builder/pages", label: "Pages", icon: FileText },
      { to: "/builder/sections", label: "Sections", icon: ListTree },
      { to: "/builder/themes", label: "Themes", icon: Palette },
      { to: "/builder/menus", label: "Menus", icon: ListTree },
      { to: "/builder/posts", label: "Posts", icon: Newspaper },
      { to: "/builder/products", label: "Products", icon: ShoppingBag },
      { to: "/media", label: "Media Library", icon: Image },
      { to: "/templates", label: "Templates", icon: LayoutTemplate },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/monitoring", label: "Monitoring", icon: MonitorCheck },
      { to: "/audit", label: "Audit Logs", icon: ScrollText },
      { to: "/users", label: "Users & Roles", icon: Users },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export const ALL_ENTRIES: MenuEntry[] = MENU.flatMap((s) => s.items);
