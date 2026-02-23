# Adding Navigation Link to Holiday Management

## Quick Guide

To make the Holiday Management page easily accessible, add a navigation link in your admin menu.

## Option 1: Add to Main Navigation (Recommended)

If you have a main navigation component (e.g., `MainLayout.jsx`, `Sidebar.jsx`, `AdminMenu.jsx`), add this link:

```jsx
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

// In your navigation items array:
{
  title: 'Holiday Management',
  path: '/admin/holidays',
  icon: <CalendarTodayIcon />,
  roles: ['Admin', 'HR'], // Only visible to Admin/HR
}
```

## Option 2: Add to Admin Dashboard

If you have an admin dashboard with quick links, add:

```jsx
<Card>
  <CardActionArea onClick={() => navigate('/admin/holidays')}>
    <CardContent>
      <CalendarTodayIcon fontSize="large" color="primary" />
      <Typography variant="h6">Holiday Management</Typography>
      <Typography variant="body2" color="text.secondary">
        Manage leave years and holidays
      </Typography>
    </CardContent>
  </CardActionArea>
</Card>
```

## Option 3: Add to Settings Menu

If you have a settings or manage section:

```jsx
<ListItem button onClick={() => navigate('/admin/holidays')}>
  <ListItemIcon>
    <CalendarTodayIcon />
  </ListItemIcon>
  <ListItemText 
    primary="Holiday Management" 
    secondary="Manage leave years and holidays"
  />
</ListItem>
```

## Recommended Icon

Use Material-UI's `CalendarTodayIcon` for consistency:

```jsx
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
```

Alternative icons:
- `EventIcon` - Calendar with event marker
- `DateRangeIcon` - Calendar with date range
- `TodayIcon` - Calendar with today highlighted

## Access Control

Ensure the link is only visible to Admin and HR users:

```jsx
const { user } = useAuth();
const isAdminOrHR = user?.role === 'Admin' || user?.role === 'HR';

{isAdminOrHR && (
  <MenuItem onClick={() => navigate('/admin/holidays')}>
    <CalendarTodayIcon sx={{ mr: 1 }} />
    Holiday Management
  </MenuItem>
)}
```

## Example: Complete Navigation Item

```jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { ListItem, ListItemIcon, ListItemText } from '@mui/material';

function AdminNavigation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminOrHR = user?.role === 'Admin' || user?.role === 'HR';

  if (!isAdminOrHR) return null;

  return (
    <ListItem 
      button 
      onClick={() => navigate('/admin/holidays')}
      sx={{
        '&:hover': {
          backgroundColor: 'rgba(255, 0, 0, 0.04)',
        },
      }}
    >
      <ListItemIcon>
        <CalendarTodayIcon sx={{ color: 'primary.main' }} />
      </ListItemIcon>
      <ListItemText 
        primary="Holiday Management" 
        secondary="Manage leave years and holidays"
        primaryTypographyProps={{
          fontWeight: 500,
          fontSize: '0.95rem',
        }}
        secondaryTypographyProps={{
          fontSize: '0.8rem',
        }}
      />
    </ListItem>
  );
}
```

## Testing

After adding the navigation link:

1. Login as Admin or HR user
2. Look for "Holiday Management" in your navigation
3. Click the link
4. Verify you're redirected to `/admin/holidays`
5. Verify the page loads correctly

## Styling Tips

Match your existing navigation style:
- Use the same icon size and color scheme
- Follow the same hover effects
- Maintain consistent spacing and typography
- Use the same transition animations

---

**Note:** The exact implementation will depend on your existing navigation structure. Adapt the examples above to match your codebase.
