import React from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "../ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import logoImage from "../../assets/logo-D_k9ADKT.png";

export const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-4 border-b px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Kplr" className="w-10 h-10 rounded" />
            <span className="text-sm font-semibold tracking-[0.15em] text-muted-foreground/70 uppercase leading-tight">
              Your AI QA co-pilot
            </span>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

