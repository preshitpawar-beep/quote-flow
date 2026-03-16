import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Factory, LayoutDashboard, FilePlus, Users, LogOut } from 'lucide-react';

const buyerNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rfq/new', label: 'New RFQ', icon: FilePlus },
  { to: '/suppliers', label: 'Suppliers', icon: Users },
];
const supplierNav = [
  { to: '/dashboard', label: 'My Quotes', icon: LayoutDashboard },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const { role } = useRole();
  const location = useLocation();
  const nav = role === 'supplier' ? supplierNav : buyerNav;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border hover:bg-sidebar-accent/20 transition-colors">
          <div className="w-8 h-8 rounded-md gradient-accent flex items-center justify-center shrink-0">
            <Factory className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">QuoteForge</div>
            <div className="text-[10px] text-sidebar-foreground/40">Stenner Ltd</div>
          </div>
        </Link>

        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(item => {
            const active = location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-sidebar-border">
          <div className="px-3 py-1.5 text-xs text-sidebar-foreground/40 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm"
            className="w-full justify-start gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
            onClick={signOut}
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
