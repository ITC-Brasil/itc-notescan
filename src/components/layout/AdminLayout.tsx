"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Truck,
  Laptop,
  Bell,
  Users,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MASTER"] },
  { href: "/relatorios", label: "Relatórios", icon: FileText, roles: ["ADMIN", "MASTER"] },
  { href: "/projetos", label: "Projetos", icon: FolderOpen, roles: ["ADMIN", "MASTER"] },
  { href: "/ums", label: "Unidades Móveis", icon: Truck, roles: ["ADMIN", "MASTER"] },
  { href: "/notebooks", label: "Notebooks", icon: Laptop, roles: ["ADMIN", "MASTER"] },
  { href: "/notificacoes", label: "Notificações", icon: Bell, roles: ["ADMIN", "MASTER"] },
  { href: "/usuarios", label: "Usuários", icon: Users, roles: ["MASTER"] },
] as const;

function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const ThemeIcon =
    theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <ThemeIcon className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="h-4 w-4 mr-2" />
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="h-4 w-4 mr-2" />
          Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="h-4 w-4 mr-2" />
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = session?.user.role ?? "";

  const visibleItems = navItems.filter((item) =>
    (item.roles as readonly string[]).includes(role),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex items-center gap-2 cursor-default">
                <div className="h-7 w-7 rounded-md bg-[--itc-ciano-7] flex items-center justify-center flex-shrink-0">
                  <Laptop className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-foreground text-sm group-data-[collapsible=icon]:hidden">
                  NoteScan
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon className={cn("h-4 w-4", isActive && "text-[--itc-ciano-7]")} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="space-y-1 px-1">
          <ThemeToggle />
          <Separator className="my-1" />
          <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
            <div className="h-7 w-7 rounded-full bg-[--itc-ciano-7]/20 flex items-center justify-center text-xs font-semibold text-[--itc-ciano-7] flex-shrink-0">
              {session?.user.nome?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-xs font-medium text-foreground truncate">
                {session?.user.nome}
              </p>
              <p className="text-xs text-muted-foreground">{role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:justify-center"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Sair</span>
          </Button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 min-h-screen">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <span className="font-semibold text-foreground text-sm">NoteScan</span>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
