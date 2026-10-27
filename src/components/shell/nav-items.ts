import {
  Activity,
  Award,
  Bell,
  Flag,
  GitBranch,
  LayoutDashboard,
  Repeat,
  ScrollText,
  Settings,
  Timer,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Phase in which the module ships; undefined = available now. */
  lockedUntil?: number;
  mobile?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/system", label: "Status", icon: LayoutDashboard, mobile: true },
  { href: "/system/quests", label: "Quests", icon: ScrollText, mobile: true },
  { href: "/system/habits", label: "Habits", icon: Repeat, lockedUntil: 6 },
  { href: "/system/focus", label: "Focus", icon: Timer, lockedUntil: 8 },
  { href: "/system/goals", label: "Goals", icon: Flag, lockedUntil: 8 },
  { href: "/system/skills", label: "Skills", icon: GitBranch, lockedUntil: 7 },
  { href: "/system/achievements", label: "Achievements", icon: Award, lockedUntil: 7 },
  { href: "/system/progress", label: "Progress", icon: Activity, lockedUntil: 9 },
  { href: "/system/notifications", label: "Notifications", icon: Bell, mobile: true },
  { href: "/system/settings", label: "Settings", icon: Settings, mobile: true },
];
