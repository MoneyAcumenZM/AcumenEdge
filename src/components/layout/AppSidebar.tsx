import { Home, Activity as BarChart2, ArrowDownUp as ArrowLeftRight, CandlestickChart as LineChart, Wallet as Briefcase, Bookmark as Star, CircleUser as User, ListChecks as ClipboardList, LogOut, Landmark as FileText } from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUI } from "@/contexts/UIContext";
import { HapticFeedback } from "@/services/haptics";

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isDepositOpen } = useUI();

  const isHomePage = location.pathname === "/";

  const dockItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: BarChart2, label: "Market", path: "/market" },
    { icon: ArrowLeftRight, label: "Trade", path: "/trade" },
    { icon: LineChart, label: "Charts", path: "/charts" },
    { icon: Briefcase, label: "Portfolio", path: "/portfolio" },
    { icon: Star, label: "Watchlist", path: "/watchlist" },
    { icon: ClipboardList, label: "Orders", path: "/my-orders" },
    { icon: FileText, label: "Bonds", path: "/bonds" },
    { icon: User, label: "Profile", path: "/profile" },
    { icon: LogOut, label: "Sign Out", path: "/signout" },
  ];

  const mobileBottomNav = [
    { icon: Home, label: "Home", path: "/" },
    { icon: BarChart2, label: "Market", path: "/market" },
    { icon: ArrowLeftRight, label: "Trade", path: "/trade" },
    { icon: LineChart, label: "Charts", path: "/charts" },
    { icon: Briefcase, label: "Portfolio", path: "/portfolio" },
  ];

  const handleNavClick = async (path: string) => {
    HapticFeedback.light();
    if (path === "/signout") {
      await signOut();
      navigate("/signin");
      return;
    }
    navigate(path);
  };

  return (
    <>
      {/* ── Desktop Dock ── */}
      <nav className="hidden md:flex fixed bottom-4 left-1/2 -translate-x-1/2 z-50 items-end gap-1 px-3 py-2 rounded-2xl dock-bar">
        {dockItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isLogout = item.path === "/signout";
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className="dock-item group relative flex flex-col items-center"
              title={item.label}>
              <span className="dock-tooltip">{item.label}</span>
              <div className={`dock-icon-wrap ${isActive ? "dock-icon-active" : ""} ${isLogout ? "dock-icon-logout" : ""}`}>
                <item.icon className="w-5 h-5 relative z-10" />
              </div>
              {/* Always show label on desktop */}
              <span className={`text-[8px] mt-0.5 font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{item.label}</span>
              {isActive && <div className="w-1 h-1 rounded-full bg-primary shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* ── Mobile bottom navigation — hidden on home page ── */}
      {!isDepositOpen && !isHomePage && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-bottom px-4 pb-3" style={{ WebkitTransform: 'translateZ(0)' }}>
          <div className="relative flex items-center justify-around rounded-[28px] px-2 pt-2 pb-2 border border-[#0a3d10]/60"
            style={{
              background: 'linear-gradient(135deg, #042a08 0%, #021e05 40%, #0a3210 70%, #021e05 100%)',
              boxShadow: '0 8px 32px -8px rgba(2,30,5,0.7), 0 2px 12px rgba(255,139,3,0.06), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)',
            }}>
            <div className="absolute inset-0 rounded-[28px] pointer-events-none"
              style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.12) 0%, transparent 35%, transparent 65%, rgba(255,255,255,0.05) 100%)' }} />

            {mobileBottomNav.map((item) => {
              const isActive = location.pathname === item.path;
              const isTrade = item.path === "/trade";

              if (isTrade) {
                return (
                  <Link key={item.path} to={item.path} onClick={() => HapticFeedback.light()} className="relative -mt-7 flex flex-col items-center z-10">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #ff9503 0%, #ff8b03 50%, #e67e00 100%)',
                        boxShadow: '0 4px 20px rgba(255,139,3,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
                      }}>
                      <item.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-[7px] font-medium mt-0.5" style={{ color: isActive ? '#ff8b03' : 'rgba(255,255,255,0.5)' }}>{item.label}</span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ff8b03' }} />}
                  </Link>
                );
              }

              return (
                <Link key={item.path} to={item.path} onClick={() => HapticFeedback.light()}
                  className="flex flex-col items-center gap-0.5 py-1.5 px-3 transition-colors relative z-10">
                  <item.icon className="w-5 h-5" style={{ color: isActive ? '#ff8b03' : 'rgba(255,255,255,0.45)' }} />
                  <span className="text-[8px] font-medium" style={{ color: isActive ? '#ff8b03' : 'rgba(255,255,255,0.35)' }}>{item.label}</span>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ff8b03' }} />}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
};

export default AppSidebar;
