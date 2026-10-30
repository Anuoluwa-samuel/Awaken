import {
  Award,
  BookOpen,
  CalendarCheck,
  ChevronsUp,
  Crown,
  Flame,
  GitBranch,
  Palette,
  Repeat,
  Sparkles,
  Swords,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  swords: Swords,
  sparkles: Sparkles,
  repeat: Repeat,
  flame: Flame,
  "calendar-check": CalendarCheck,
  "git-branch": GitBranch,
  "chevrons-up": ChevronsUp,
  "book-open": BookOpen,
  palette: Palette,
  crown: Crown,
};

export function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Award;
  return <Icon aria-hidden className={className} />;
}
