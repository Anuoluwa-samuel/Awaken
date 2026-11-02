import {
  Activity,
  Award,
  Bell,
  BookOpen,
  Flag,
  GitBranch,
  LayoutDashboard,
  Repeat,
  ScrollText,
  Settings,
  Timer,
  Trophy,
  UserRound,
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
  { href: "/system/profile", label: "Profile", icon: UserRound },
  { href: "/system/habits", label: "Habits", icon: Repeat, mobile: true },
  { href: "/system/focus", label: "Focus", icon: Timer },
  { href: "/system/goals", label: "Goals", icon: Flag },
  { href: "/system/skills", label: "Skills", icon: GitBranch },
  { href: "/system/achievements", label: "Achievements", icon: Award },
  { href: "/system/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/system/progress", label: "Progress", icon: Activity },
  { href: "/system/notifications", label: "Notifications", icon: Bell, mobile: true },
  { href: "/system/settings", label: "Settings", icon: Settings },
  { href: "/guide", label: "Guide", icon: BookOpen },
];
