import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  LogOut, 
  Bell, 
  User,
  Menu,
  X,
  History,
  ShieldCheck,
  FileCheck,
  Users,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { auth } from '@/src/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { firestoreService } from '@/src/lib/firestore';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
}

export default function Layout({ children, activeTab, setActiveTab, user }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [logo, setLogo] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsub = firestoreService.subscribeDoc('settings', 'general', (data: any) => {
      if (data?.logo) setLogo(data.logo);
      else setLogo(null);
    });
    return () => unsub();
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assets', label: 'Asset Registry', icon: Package },
    { id: 'discovery', label: 'Discovery', icon: Search, adminOnly: true },
    { id: 'baselines', label: 'Baselines', icon: ShieldCheck, adminOnly: true },
    { id: 'compliance', label: 'Compliance', icon: FileCheck, adminOnly: true },
    { id: 'audit', label: 'Audit Logs', icon: History, adminOnly: true },
    { id: 'users', label: 'User Management', icon: Users, adminOnly: true },
    { id: 'settings', label: 'System Settings', icon: Settings, adminOnly: true },
  ];

  const filteredNavItems = navItems.filter(item => !item.adminOnly || user?.role === 'admin');

  const handleSignOut = () => {
    signOut(auth);
  };

  const NavContent = () => (
    <div className="flex flex-col h-full py-0">
      <div className="px-6 py-8 mb-4">
        <div className="flex items-center gap-3 font-bold text-xl tracking-tight text-sidebar-foreground">
          {logo ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex items-center justify-center">
              <img src={logo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
          <span>AssetLink Pro</span>
        </div>
      </div>
      
      <nav className="flex-1 px-3 space-y-1">
        {filteredNavItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-11 px-4 transition-all duration-200 rounded-md text-sm font-medium",
              activeTab === item.id 
                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
            onClick={() => {
              setActiveTab(item.id);
              setIsMobileMenuOpen(false);
            }}
          >
            <item.icon className={cn("w-4 h-4", activeTab === item.id ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/60")} />
            {item.label}
          </Button>
        ))}
      </nav>

      <div className="p-6 text-[10px] text-sidebar-foreground/40 border-t border-sidebar-border">
        v2.4.0 &copy; 2024<br />
        Infrastructure Mgmt
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[240px] border-r border-border bg-sidebar">
        <NavContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-[240px] bg-sidebar border-r-0">
          <NavContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </Button>
            <div className="relative hidden md:block">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground">
                <Menu className="w-4 h-4" />
              </div>
              <input 
                type="text" 
                placeholder="Search assets, serials, or vendors..." 
                className="w-[320px] h-10 pl-11 pr-4 rounded-full bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{user?.displayName || 'Admin System'}</span>
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {user?.displayName?.substring(0, 2).toUpperCase() || 'AD'}
              </div>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 bg-background">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
