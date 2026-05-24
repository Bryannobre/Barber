import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Building2, LogOut, Menu } from "lucide-react";
import PlatformBrandMark from "@/components/shared/PlatformBrandMark";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const AdminLayout = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isCompaniesActive =
    location.pathname === "/admin" ||
    location.pathname === "/owner/dashboard" ||
    location.pathname.startsWith("/owner/companies/") ||
    location.pathname.startsWith("/admin/companies/");

  const companiesLinkClass = cn(
    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
    isCompaniesActive
      ? "bg-primary/10 text-primary font-medium"
      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
  );

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col">
        <div className="p-4 border-b border-border">
          <PlatformBrandMark size="sm" showTagline={false} />
          <p className="text-xs text-muted-foreground mt-2 text-center">Painel Administrativo</p>
        </div>
        <nav className="flex-1 p-4">
          <Link
            to="/owner/dashboard"
            className={companiesLinkClass}
          >
            <Building2 size={20} />
            <span>Empresas</span>
          </Link>
        </nav>
        <div className="p-4 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground">Super Admin</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => signOut()}
          >
            <LogOut size={16} />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-3 md:p-8 scrollbar-theme">
        <div className="md:hidden mb-3 flex items-center justify-between gap-2 border border-border rounded-xl px-3 py-2 bg-card">
          <div className="flex items-center gap-2 min-w-0">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menu do admin">
                  <Menu size={18} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85%] max-w-[320px] p-0">
                <SheetHeader className="p-4 border-b border-border">
                  <SheetTitle className="font-display text-primary">Painel Administrativo</SheetTitle>
                </SheetHeader>
                <nav className="p-2 space-y-1">
                  <SheetClose asChild>
                    <Link
                      to="/owner/dashboard"
                      className={companiesLinkClass}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Building2 size={20} />
                      <span>Empresas</span>
                    </Link>
                  </SheetClose>
                </nav>
                <div className="p-4 border-t border-border">
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => signOut()}>
                    <LogOut size={16} />
                    Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-display font-semibold truncate">Super Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut size={16} className="mr-2" />
            Sair
          </Button>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
