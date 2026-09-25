import type { NavItem } from "@/components/Shell";

/** Sidebar navigation. Only features that are built appear here. */
export const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/path", label: "Learn Path", icon: "path", group: "Study" },
  { href: "/plan", label: "Study Planner", icon: "plan", group: "Study" },
  { href: "/analytics", label: "Analytics", icon: "chart", group: "Study" },
  { href: "/questions", label: "Question Bank", icon: "bank", group: "Practice" },
  { href: "/saved", label: "Saved & Mistakes", icon: "bookmark", group: "Practice" },
  { href: "/rush", label: "Question Rush", icon: "bolt", group: "Practice" },
  { href: "/challenge", label: "Challenge Questions", icon: "mountain", group: "Practice" },
  { href: "/tests", label: "Practice Tests", icon: "test", group: "Tests" },
  { href: "/lessons", label: "Lessons", icon: "book", group: "Learn" },
  { href: "/custom", label: "Custom Lessons", icon: "sparkle", group: "Learn" },
  { href: "/vocab", label: "Vocab", icon: "cards", group: "Learn" },
  { href: "/tutor", label: "Ask Tutor", icon: "chat", group: "Learn", requiresAi: true },
  { href: "/leaderboard", label: "Leaderboard", icon: "trophy", group: "Manage" },
  { href: "/content", label: "Content tools", icon: "pencil", group: "Manage" },
  { href: "/settings", label: "Settings", icon: "gear", group: "Manage" },
];
