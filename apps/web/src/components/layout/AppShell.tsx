"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ChevronDown,
  DatabaseBackup,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "@/lib/auth-client";
import { Logo } from "@/components/ui/Logo";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useLayoutStore, SIDEBAR_DEFAULT } from "@/stores/layout-store";
import { ThemeMenu } from "./ThemeMenu";

const NAV = [
  { href: "/", label: "Workspace", icon: Send },
  { href: "/monitors", label: "Monitors", icon: Activity },
];

/**
 * Responsive application frame:
 * - mobile: header + hamburger that opens the sidebar as a drawer
 * - lg+: resizable, collapsible sidebar next to the content
 */
export function AppShell({
  sidebar,
  children,
  onOpenBackup,
}: {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  /** Shows "Backup & import" in the account menu */
  onOpenBackup?: () => void;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { sidebarOpen, sidebarWidth, toggleSidebar, setSidebarWidth } = useLayoutStore();
  const shellRef = useRef<HTMLDivElement>(null);

  // Restore the saved panel layout after hydration
  useEffect(() => {
    void useLayoutStore.persist.rehydrate();
  }, []);

  // Ctrl/Cmd+B toggles the sidebar (drawer on small screens)
  useEffect(() => {
    if (!sidebar) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 1024px)").matches) toggleSidebar();
        else setDrawerOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebar, toggleSidebar]);

  // Close the drawer on navigation and on Escape
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="flex flex-col h-dvh bg-surface-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn-primary"
      >
        Skip to content
      </a>

      {/* ===== Header ===== */}
      <header className="relative z-30 h-14 shrink-0 flex items-center gap-2 sm:gap-4 px-3 sm:px-4 border-b border-line/5 bg-surface-1/60 backdrop-blur-md">
        {sidebar && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-3"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {sidebar && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden lg:inline-flex p-2 -ml-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-3"
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-pressed={sidebarOpen}
            title={sidebarOpen ? "Hide sidebar (Ctrl+B)" : "Show sidebar (Ctrl+B)"}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        )}

        <Logo />

        <nav aria-label="Main" className="flex items-center gap-1 ml-1 sm:ml-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-600/15 text-brand-300"
                    : "text-gray-400 hover:text-gray-200 hover:bg-surface-3"
                )}
              >
                <Icon className="w-4 h-4" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeMenu />
          <UserMenu onOpenBackup={onOpenBackup} />
        </div>
      </header>

      <div ref={shellRef} className="flex flex-1 min-h-0">
        {/* ===== Sidebar (desktop) ===== */}
        {sidebar && sidebarOpen && (
          <>
            <aside
              style={{ width: sidebarWidth }}
              className="hidden lg:flex shrink-0 flex-col bg-surface-1/50 border-r border-line/5"
            >
              {sidebar}
            </aside>
            <ResizeHandle
              axis="x"
              label="Resize sidebar"
              className="hidden lg:block"
              onDrag={(x) => setSidebarWidth(x - (shellRef.current?.getBoundingClientRect().left ?? 0))}
              onNudge={(dir, large) => setSidebarWidth(sidebarWidth + dir * (large ? 64 : 16))}
              onReset={() => setSidebarWidth(SIDEBAR_DEFAULT)}
            />
          </>
        )}

        {/* ===== Sidebar (mobile drawer) ===== */}
        {sidebar && drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Sidebar">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-[85vw] max-w-xs flex flex-col bg-surface-1 border-r border-line/10 shadow-2xl animate-slide-in-left">
              <div className="flex items-center justify-between px-4 h-14 border-b border-line/5">
                <Logo />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-3"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}

        <main id="main-content" className="flex-1 min-w-0 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}

function UserMenu({ onOpenBackup }: { onOpenBackup?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (isPending) {
    return <div className="w-24 h-8 rounded-lg bg-surface-2 animate-pulse" aria-hidden />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`}
          className="btn-ghost text-sm flex items-center gap-1.5 whitespace-nowrap px-2 sm:px-3"
        >
          <LogIn className="w-4 h-4" aria-hidden />
          Sign in
        </Link>
        <Link href="/register" className="hidden sm:inline-block btn-primary text-sm py-1.5">
          Sign up free
        </Link>
      </div>
    );
  }

  const user = session.user;
  const initials = (user.name || user.email).slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-surface-3 transition-colors"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="w-7 h-7 rounded-full bg-brand-600/30 text-brand-200 text-xs font-semibold flex items-center justify-center">
            {initials}
          </span>
        )}
        <span className="hidden md:block text-sm text-gray-300 max-w-[140px] truncate">
          {user.name || user.email}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-500" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 z-50 glass-card bg-surface-2 shadow-xl p-1.5 animate-scale-in"
        >
          <div className="px-3 py-2 border-b border-line/5 mb-1">
            <p className="text-sm text-gray-200 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          {onOpenBackup && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenBackup();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-surface-3"
            >
              <DatabaseBackup className="w-4 h-4" aria-hidden />
              Backup &amp; import
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              await signOut();
              setOpen(false);
              router.replace("/");
              router.refresh();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-surface-3"
          >
            <LogOut className="w-4 h-4" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
