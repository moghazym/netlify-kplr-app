import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "../ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import logoImage from "../../assets/logo-D_k9ADKT.png";
import { cn } from "../../lib/utils";

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const isTestRunDetailPage = location.pathname.startsWith('/test-runs/') && location.pathname !== '/test-runs';
  
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {!isTestRunDetailPage && (
          <header className="flex h-16 shrink-0 items-center gap-4 border-b px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Kplr" className="w-10 h-10 rounded" />
              <span className="text-sm font-semibold tracking-[0.15em] text-muted-foreground/70 uppercase leading-tight">
                Your AI QA co-pilot
              </span>
            </div>
          </header>
        )}
        <div className={cn("flex flex-1 flex-col", isTestRunDetailPage ? "" : "gap-4 p-4 pt-0")}>
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

