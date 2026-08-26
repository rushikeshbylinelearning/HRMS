// src/components/AppLayout.jsx
// Icon-only sidebar (navy-deep) + frosted topbar — payroll design system.
// Sidebar sizing matches AMS exactly: 56×56 links, 32×32 icon containers, 12px radius.
// Sidebar background is --sidebar-navy-deep (#10193f) — deliberately one shade
// deeper than AMS (#192a56) so users immediately know they're in payroll.
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import {
  Box, Typography, Avatar, Menu, MenuItem, Divider,
  Tooltip, IconButton, useMediaQuery, Drawer,
} from '@mui/material';
import {
  Dashboard        as DashboardIcon,
  ReceiptLong      as RunsIcon,
  Description      as SlipsIcon,
  People           as ProfilesIcon,
  Settings         as SettingsIcon,
  FolderOpen       as FolderIcon,
  Link             as LinkIcon,
  History          as AuditIcon,
  ManageAccounts   as UsersIcon,
  Menu             as MenuIcon,
  Logout           as LogoutIcon,
  AccountCircle    as AccountIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { label: 'Dashboard',     path: '/dashboard',          icon: DashboardIcon, roles: ['Admin','PayrollOfficer'] },
  { label: 'Payroll Runs',  path: '/payroll-runs',       icon: RunsIcon,      roles: ['Admin','PayrollOfficer'] },
  { label: 'Salary Slips',  path: '/salary-slips',       icon: SlipsIcon,     roles: ['Admin','PayrollOfficer'] },
  { label: 'Profiles',      path: '/financial-profiles', icon: ProfilesIcon,  roles: ['Admin','PayrollOfficer'] },
  { label: 'Folders',       path: '/folders',            icon: FolderIcon,    roles: ['Admin','PayrollOfficer'] },
  { label: 'Share Links',   path: '/links',              icon: LinkIcon,      roles: ['Admin','PayrollOfficer'] },
  { label: 'Settings',      path: '/settings',           icon: SettingsIcon,  roles: ['Admin'] },
  { label: 'Users',         path: '/users',              icon: UsersIcon,     roles: ['Admin'] },
  { label: 'Audit Logs',    path: '/audit-logs',         icon: AuditIcon,     roles: ['Admin'] },
];

// ─── Single sidebar nav link ─────────────────────────────────────────────────
function NavItem({ item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      data-tooltip={item.label}
      className={({ isActive }) =>
        `payroll-nav-link${isActive ? ' active' : ''}`
      }
      aria-label={item.label}
    >
      <span className="payroll-nav-link__icon">
        <Icon sx={{ fontSize: 18 }} />
      </span>
      <span className="payroll-nav-link__label">{item.label}</span>
    </NavLink>
  );
}

// ─── Sidebar content (shared between permanent + drawer) ────────────────────
function SidebarContent({ visibleNav, onNavClick }) {
  const { user, logout } = useAuth();
  const initial = (user?.fullName || user?.email || '?')[0].toUpperCase();

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--sidebar-navy-deep)',
        width: '100%',
      }}
    >
      {/* Logo mark */}
      <Box
        sx={{
          width: 40, height: 40,
          borderRadius: 2,
          bgcolor: 'var(--brand-red)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          mt: 2, mb: 1, flexShrink: 0,
        }}
        aria-label="Payroll portal"
      >
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1 }}>
          ₹
        </Typography>
      </Box>

      {/* Nav items */}
      <nav className="payroll-sidebar__nav" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {visibleNav.map(item => (
          <NavItem key={item.path} item={item} onClick={onNavClick} />
        ))}
      </nav>

      {/* Footer: user avatar + logout */}
      <Box sx={{ pb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Divider sx={{ width: 40, borderColor: 'rgba(255,255,255,0.12)', mb: 1 }} />
        <Tooltip title={user?.fullName || user?.email || ''} placement="right">
          <Avatar
            sx={{
              width: 32, height: 32, fontSize: 13,
              bgcolor: 'var(--brand-red)',
              cursor: 'default',
              border: '2px solid rgba(255,255,255,0.15)',
            }}
          >
            {initial}
          </Avatar>
        </Tooltip>
        <Tooltip title="Sign out" placement="right">
          <IconButton
            size="small"
            onClick={logout}
            aria-label="Sign out"
            sx={{
              color: 'rgba(255,255,255,0.5)',
              width: 32, height: 32,
              borderRadius: '8px',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            <LogoutIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

// ─── Topbar ──────────────────────────────────────────────────────────────────
function Topbar({ onMenuOpen }) {
  const { user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { logout } = useAuth();
  const isMobile = useMediaQuery('(max-width:768px)');

  useEffect(() => {
    const el = document.querySelector('.payroll-content');
    if (!el) return;
    const handler = () => setScrolled(el.scrollTop > 4);
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [location.pathname]);

  // Page title from current nav entry
  const currentNav = NAV.find(n => location.pathname.startsWith(n.path));
  const pageTitle = currentNav?.label || 'Payroll';

  return (
    <Box
      className={`payroll-topbar${scrolled ? ' scrolled' : ''}`}
      component="header"
    >
      {isMobile && (
        <IconButton
          size="small"
          onClick={onMenuOpen}
          aria-label="Open navigation"
          sx={{ mr: 1, color: 'var(--ink-secondary)' }}
        >
          <MenuIcon />
        </IconButton>
      )}

      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          color: 'var(--ink)',
          fontSize: '1rem',
          flexGrow: 1,
        }}
      >
        {pageTitle}
      </Typography>

      {/* Right: user menu */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="body2"
          sx={{ color: 'var(--ink-secondary)', display: { xs: 'none', sm: 'block' } }}
        >
          {user?.fullName || user?.email}
        </Typography>
        <IconButton
          size="small"
          onClick={e => setAnchorEl(e.currentTarget)}
          aria-label="Account menu"
          sx={{ color: 'var(--ink-secondary)' }}
        >
          <AccountIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: { mt: 1, minWidth: 180, borderRadius: 2, border: '1px solid var(--border)' },
          }}
        >
          <MenuItem dense disabled sx={{ opacity: '1 !important' }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>{user?.fullName}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setAnchorEl(null); logout(); }}>
            <LogoutIcon fontSize="small" sx={{ mr: 1.5, color: 'var(--ink-secondary)' }} />
            Sign out
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

// ─── Root layout ─────────────────────────────────────────────────────────────
export default function AppLayout({ children }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:768px)');

  const visibleNav = NAV.filter(item => item.roles.includes(user?.role));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Permanent sidebar — desktop only */}
      {!isMobile && (
        <Box
          component="nav"
          aria-label="Main navigation"
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 'var(--sidebar-width)',
            height: '100vh',
            zIndex: 1200,
            background: 'var(--sidebar-navy-deep)',
          }}
        >
          <SidebarContent visibleNav={visibleNav} onNavClick={undefined} />
        </Box>
      )}

      {/* Temporary drawer — mobile */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              width: 240,
              background: 'var(--sidebar-navy-deep)',
              border: 'none',
            },
          }}
        >
          <SidebarContent
            visibleNav={visibleNav}
            onNavClick={() => setMobileOpen(false)}
          />
        </Drawer>
      )}

      {/* Main area: topbar + page content */}
      <Box
        sx={{
          flex: 1,
          ml: isMobile ? 0 : 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <Topbar onMenuOpen={() => setMobileOpen(true)} />

        {/* Scrollable content area */}
        <Box
          className="payroll-content"
          component="main"
          sx={{
            flex: 1,
            mt: 'var(--topbar-height)',
            background: 'var(--surface)',
            overflowY: 'auto',
            overflowX: 'hidden',
            width: '100%',
          }}
        >
          {/* Inner wrapper — sizing and padding come entirely from index.css
              (.payroll-content__inner) so that the topbar and content always
              share --content-padding-x and can never drift apart.
              No competing mx/px/maxWidth inline sx here. */}
          <Box className="payroll-content__inner">
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
