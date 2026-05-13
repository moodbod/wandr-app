"use client";

import type { ComponentType } from "react";
import { Compass, Route, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type BottomNavProps = {
  onTripsClick?: () => void;
};

type NavTab = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
};

const navTabs: NavTab[] = [
  { id: "explore", label: "Explore", icon: Compass, href: "/" },
  { id: "trips", label: "Trips", icon: Route, href: "/" },
  { id: "settings", label: "Settings", icon: Settings2, href: "/settings" },
];

export function BottomNav({ onTripsClick }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="wandr-bottom-nav lg:hidden" aria-label="Main navigation">
      {navTabs.map((tab) => {
        const isActive =
          (tab.id === "explore" && pathname === "/") ||
          (tab.id === "settings" && pathname === "/settings");
        const Icon = tab.icon;

        if (tab.id === "trips" && onTripsClick) {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={onTripsClick}
              className={`wandr-bottom-nav__tab${isActive ? " wandr-bottom-nav__tab--active" : ""}`}
            >
              <Icon className="size-[1.6rem]" />
            </button>
          );
        }

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`wandr-bottom-nav__tab${isActive ? " wandr-bottom-nav__tab--active" : ""}`}
          >
            <Icon className="size-[1.6rem]" />
          </Link>
        );
      })}
    </nav>
  );
}
