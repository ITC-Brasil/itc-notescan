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
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyRound } from "lucide-react";
import { ChangePasswordModal } from "@/components/ui/ChangePasswordModal";

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
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="group-data-[collapsible=icon]:hidden">
        {isDark ? "Modo Claro" : "Modo Escuro"}
      </span>
    </Button>
  );
}

function AppSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = session?.user.role ?? "";
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const visibleItems = navItems.filter((item) =>
    (item.roles as readonly string[]).includes(role),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="h-7 w-7 rounded-md bg-[--itc-ciano-7] flex items-center justify-center flex-shrink-0">
            <Laptop className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-foreground text-sm group-data-[collapsible=icon]:hidden">
            NoteScan
          </span>
        </div>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors group-data-[collapsible=icon]:justify-center">
                <div className="h-7 w-7 rounded-full bg-[--itc-ciano-7]/20 flex items-center justify-center text-xs font-semibold text-[--itc-ciano-7] flex-shrink-0">
                  {session?.user.nome?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
                  <p className="text-xs font-medium text-foreground truncate">
                    {session?.user.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">{role}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                {session?.user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                <KeyRound className="h-4 w-4 mr-2" />
                Alterar senha
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>

      <ChangePasswordModal
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />

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
          <main className="admin-main flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
