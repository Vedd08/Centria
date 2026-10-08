import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  LogOut,
  Bell,
  ChevronDown,
  X,
  Loader2,
  Users,
  Calendar,
  Receipt,
  Menu
} from 'lucide-react';
import { ProfileModal } from './common/ProfileModal';
import { BrandLogo } from './common/BrandLogo';

import { NavTab, NavItemConfig, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS, ALL_NAV_ITEMS, effectiveRoleFor } from '../config/navigation';

interface TopNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const TopNav: React.FC<TopNavProps> = ({ activeTab, onSelectTab }) => {
  const { user, token, logout, apiFetch, clinicContext } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [notifications, setNotifications] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch dashboard metrics for notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const headers = { };
        const [medRes, invRes, rxRes] = await Promise.allSettled([
          apiFetch('/api/medicines', { headers }),
          apiFetch('/api/invoices?reconciled=false', { headers }),
          apiFetch('/api/prescriptions?status=Pending', { headers }),
        ]);

        const items: any[] = [];

        if (medRes.status === 'fulfilled' && medRes.value.ok) {
          const meds = await medRes.value.json();
          if (Array.isArray(meds)) {
            meds.filter((m: any) => (m.stockQty ?? 0) <= (m.reorderPoint ?? 10)).forEach((m: any) => {
              items.push({ type: 'warning', message: `Low stock: ${m.name} (${m.stockQty} ${m.unit}s remaining)`, link: 'medicines' });
            });
          }
        }

        if (invRes.status === 'fulfilled' && invRes.value.ok) {
          const result = await invRes.value.json();
          const count = Array.isArray(result) ? result.length : (result.total || 0);
          if (count > 0) {
            items.push({ type: 'info', message: `${count} unreconciled invoice(s)`, link: 'invoices' });
          }
        }

        if (rxRes.status === 'fulfilled' && rxRes.value.ok) {
          const rxs = await rxRes.value.json();
          const count = Array.isArray(rxs) ? rxs.length : 0;
          if (count > 0) {
            items.push({ type: 'info', message: `${count} prescription(s) pending dispense`, link: 'prescriptions' });
          }
        }

        // Follow-ups summary — only relevant for RECEPTION and RM
        if (user && ['RECEPTION', 'RM', 'MASTER', 'SUPER_ADMIN'].includes(user.role)) {
          try {
            const fuRes = await apiFetch('/api/follow-ups/summary');
            if (fuRes.ok) {
              const fuData = await fuRes.json();
              const fuCount = fuData.total ?? 0;
              if (fuCount > 0) {
                items.push({ type: 'followup', message: `${fuCount} follow-up${fuCount !== 1 ? 's' : ''} due`, link: 'reception', tab: 'followups' });
              }
            }
          } catch {}
        }

        setNotifications(items);
      } catch {}
    };
    fetchNotifications();
  }, [user?.role]);

  const handleSearchInput = (query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const headers = { };
        const [patRes, visRes, invRes] = await Promise.allSettled([
          apiFetch(`/api/patients?search=${encodeURIComponent(query)}`, { headers }),
          apiFetch(`/api/visits?search=${encodeURIComponent(query)}`, { headers }),
          apiFetch(`/api/invoices?search=${encodeURIComponent(query)}`, { headers }),
        ]);
        const results: any[] = [];

        if (patRes.status === 'fulfilled' && patRes.value.ok) {
          const result = await patRes.value.json();
          const items = Array.isArray(result) ? result : (result.data || []);
          items.forEach((p: any) => results.push({ type: 'patient', label: `Patient: ${p.name}`, sub: p.uhid, id: p.id }));
        }
        if (visRes.status === 'fulfilled' && visRes.value.ok) {
          const result = await visRes.value.json();
          const items = Array.isArray(result) ? result : (result.data || []);
          items.slice(0, 5).forEach((v: any) => results.push({ type: 'visit', label: `Visit: ${v.patient?.name}`, sub: v.treatmentName, id: v.id }));
        }
        if (invRes.status === 'fulfilled' && invRes.value.ok) {
          const result = await invRes.value.json();
          const items = Array.isArray(result) ? result : (result.data || []);
          items.slice(0, 5).forEach((i: any) => results.push({ type: 'invoice', label: `Invoice: ${i.invoiceNumber}`, sub: i.patientName, id: i.id }));
        }
        setSearchResults(results);
      } catch {}
      finally { setSearching(false); }
    }, 300);
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  };

  if (!user) return null;

  const MAX_INLINE_TABS = 7;

  // Inside a client hospital a platform admin navigates as that hospital's owner.
  const navRole = effectiveRoleFor(user.role, !!clinicContext);
  const allowedPrimary = PRIMARY_NAV_ITEMS.filter((item) => item.allowedRoles.includes(navRole));
  const allowedSecondary = SECONDARY_NAV_ITEMS.filter((item) => item.allowedRoles.includes(navRole));

  // Admins can see nearly every screen; without a cap the bar runs off the page.
  const visiblePrimaryItems = allowedPrimary.slice(0, MAX_INLINE_TABS);
  const overflowPrimary = allowedPrimary.slice(MAX_INLINE_TABS);
  const visibleSecondaryItems = [...overflowPrimary, ...allowedSecondary];

  const isSecondaryActive = visibleSecondaryItems.some((item) => item.id === activeTab);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <header className="h-[60px] bg-shell sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between font-sans">
      {/* The logo's blue→teal "C", drawn out as the bar's bottom rule. */}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-brand-gradient" />

      {/* Left: Brand */}
      <div className="flex items-center shrink-0">
        <BrandLogo tone="onDark" className="h-6 sm:h-[26px]" />
      </div>

      {/* Mobile Hamburger */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden p-2 text-shell-muted hover:text-white rounded-md transition-colors cursor-pointer"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Center: Inline Navigation */}
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[60px] z-30 bg-shell border-t border-shell-line md:hidden overflow-y-auto">
          <div className="p-4 space-y-1">
            {[...allowedPrimary, ...allowedSecondary].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { onSelectTab(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-brand-lift text-white font-semibold'
                      : 'text-shell-ink hover:bg-shell-raised'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="hidden md:flex items-center gap-1">
        {visiblePrimaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-brand-lift text-white font-semibold shadow-xs'
                  : 'text-shell-muted hover:text-white hover:bg-shell-raised'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* More Dropdown (Hidden if 0 secondary items accessible) */}
        {visibleSecondaryItems.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                isSecondaryActive
                  ? 'bg-brand-lift text-white font-semibold shadow-xs'
                  : 'text-shell-muted hover:text-white hover:bg-shell-raised'
              }`}
            >
              <span>More</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 mt-1 w-48 bg-surface-card rounded-[10px] border border-border shadow-md py-1.5 z-50">
                {visibleSecondaryItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-brand-soft text-brand-deep font-semibold'
                          : 'text-ink-primary hover:bg-surface-page'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0 text-ink-secondary" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>        {/* Right: Search, Notifications & User Info */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowSearch(true)}
          className="hidden sm:flex p-2 text-shell-muted hover:text-white hover:bg-shell-raised rounded-md transition-colors cursor-pointer"
          title="Search patients, visits, invoices..."
        >
          <Search className="w-4 h-4" />
        </button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-shell-muted hover:text-white hover:bg-shell-raised rounded-md transition-colors cursor-pointer relative"
            title={notifications.length > 0 ? `${notifications.length} alert(s)` : 'No alerts'}
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-status-danger" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-surface-card rounded-[10px] border border-border shadow-lg z-50 py-1.5 max-h-80 overflow-y-auto">
              <div className="px-3.5 py-2 text-xs font-semibold text-ink-secondary border-b border-border/60">
                Alerts & Notifications
              </div>
              {notifications.length === 0 ? (
                <div className="px-3.5 py-4 text-xs text-ink-secondary text-center">No alerts</div>
              ) : (
                notifications.map((n, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setShowNotifications(false);
                      onSelectTab(n.link);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-surface-page transition-colors cursor-pointer border-b border-border/40 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        n.type === 'warning' ? 'bg-status-warning' : n.type === 'followup' ? 'bg-status-success' : 'bg-brand'
                      }`} />
                      <span className="font-medium text-ink-primary">{n.message}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-shell-line mx-0.5 hidden sm:block" />

        {/* User Avatar & Info */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-8 h-8 rounded-full bg-shell-raised text-white flex items-center justify-center font-semibold text-xs border border-shell-line hover:border-brand-teal transition-colors cursor-pointer"
            title="View Profile"
          >
            {getInitials(user.name)}
          </button>
          <div className="hidden sm:block text-left">
            <button
              onClick={() => setShowProfileModal(true)}
              className="text-xs font-semibold text-white leading-tight hover:text-brand-teal transition-colors cursor-pointer"
            >
              {user.name}
            </button>
            <div className="eyebrow text-shell-muted leading-tight">{user.role}</div>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-md text-shell-muted hover:text-white hover:bg-triage-urgent transition-colors cursor-pointer ml-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showProfileModal && <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />}

      {/* Global Search Modal */}
      {showSearch && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] p-4 bg-black/40 backdrop-blur-xs"
          onClick={closeSearch}
          onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
        >
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center border-b border-border p-3 gap-3">
              <Search className="w-4 h-4 text-ink-secondary/60 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search patients, UHID, visits, invoices..."
                className="flex-1 text-sm bg-transparent border-0 outline-none text-ink-primary placeholder:text-ink-secondary/60"
              />
              {searching && <Loader2 className="w-4 h-4 animate-spin text-brand" />}
              <button onClick={closeSearch} className="p-1 rounded text-ink-secondary hover:bg-surface-page cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {searchQuery.trim() && searchResults.length === 0 && !searching && (
                <div className="p-4 text-center text-xs text-ink-secondary">No results for &quot;{searchQuery}&quot;</div>
              )}
              {searchResults.length > 0 && (
                <div className="space-y-0.5">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        closeSearch();
                        const tabMap: Record<string, NavTab> = { patient: 'patients', visit: 'visits', invoice: 'invoices' };
                        onSelectTab(tabMap[r.type] || 'dashboard');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-surface-page transition-colors cursor-pointer"
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        r.type === 'patient' ? 'bg-brand-soft text-brand-deep' :
                        r.type === 'visit' ? 'bg-tint2-bg text-tint2-text' : 'bg-tint3-bg text-tint3-text'
                      }`}>
                        {r.type === 'patient' ? <Users className="w-3.5 h-3.5" /> :
                         r.type === 'visit' ? <Calendar className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-ink-primary truncate">{r.label}</div>
                        <div className="text-[10px] text-ink-secondary truncate">{r.sub}</div>
                      </div>
                      <span className="text-[10px] uppercase font-semibold text-ink-secondary/60 shrink-0">{r.type}</span>
                    </button>
                  ))}
                </div>
              )}
              {!searchQuery.trim() && (
                <div className="p-4 text-center text-xs text-ink-secondary">Type to search across patients, visits, and invoices</div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
