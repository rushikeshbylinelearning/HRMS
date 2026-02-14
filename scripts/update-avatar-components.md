# Avatar Component Update Script

## Quick Reference for Updating Components

### Step 1: Add Import
Add this import at the top of the file:
```javascript
import UserAvatar from '../components/common/UserAvatar';
```

### Step 2: Remove Avatar from MUI Imports
```javascript
// BEFORE:
import { Avatar, Typography, Box, ... } from '@mui/material';

// AFTER:
import { Typography, Box, ... } from '@mui/material';
```

### Step 3: Replace Avatar Usage

#### Pattern 1: Simple Avatar with Initials
```javascript
// BEFORE:
<Avatar sx={{ width: 40, height: 40 }}>
  {user.fullName.charAt(0)}
</Avatar>

// AFTER:
<UserAvatar user={user} size="sm" />
```

#### Pattern 2: Avatar with Custom Styling
```javascript
// BEFORE:
<Avatar 
  sx={{ 
    width: 32, 
    height: 32, 
    bgcolor: 'primary.main',
    fontSize: '0.875rem'
  }}
>
  {employee.fullName.charAt(0)}
</Avatar>

// AFTER:
<UserAvatar 
  user={employee} 
  size={32}
  sx={{ fontSize: '0.875rem' }}
/>
```

#### Pattern 3: Avatar in Table (with Lazy Loading)
```javascript
// BEFORE:
<Avatar sx={{ width: 32, height: 32 }}>
  {employee.fullName.charAt(0).toUpperCase()}
</Avatar>

// AFTER:
<UserAvatar 
  user={employee} 
  size="xs"
  lazy={true}
/>
```

#### Pattern 4: Avatar with Chip
```javascript
// BEFORE:
<Chip
  avatar={<Avatar sx={{ bgcolor: '#dc3545' }}>{emp.fullName.charAt(0)}</Avatar>}
  label={emp.fullName}
/>

// AFTER:
<Chip
  avatar={<UserAvatar user={emp} size="xs" />}
  label={emp.fullName}
/>
```

## Size Reference

| Size | Pixels | Use Case |
|------|--------|----------|
| xs   | 32px   | Tables, chips, compact lists |
| sm   | 40px   | Topbar, small cards |
| md   | 64px   | Default, medium cards |
| lg   | 90px   | Profile sidebar, large cards |
| xl   | 120px  | Profile pages, hero sections |
| Custom | Any number | `size={48}` for custom size |

## Component Update Checklist

### Priority 1: Admin Pages (High Traffic)
- [ ] `frontend/src/pages/AdminDashboardPage.jsx`
  - Search for: `<Avatar`
  - Replace with: `<UserAvatar user={...} size="..." />`
  - Add lazy loading for tables: `lazy={true}`

- [ ] `frontend/src/pages/DeactivatedEmployeesPage.jsx`
  - Similar pattern to EmployeesPage
  - Use `size="sm"` and `lazy={true}` for table rows

### Priority 2: Employee Pages
- [ ] `frontend/src/pages/EmployeeDashboardPage.jsx`
  - Profile avatar: `size="lg"`
  - Other avatars: `size="sm"`

- [ ] `frontend/src/pages/EmployeeMusterRollPage.jsx`
  - Table avatars: `size="xs"` with `lazy={true}`

### Priority 3: Leave & Activity Pages
- [ ] `frontend/src/pages/LeavesTrackerPage.jsx`
  - Multiple avatar instances
  - Chip avatars: `size="xs"`
  - Table avatars: `size="xs"` with `lazy={true}`

- [ ] `frontend/src/pages/NewActivityLogPage.jsx`
  - Activity log avatars: `size="xs"`
  - Use lazy loading for long lists

- [ ] `frontend/src/pages/ReportsPage.jsx`
  - Autocomplete avatars: `size="xs"`

### Priority 4: Management Pages
- [ ] `frontend/src/pages/ManageSectionPage.jsx`
  - User card avatars: `size="md"`
  - Current user avatar: `size="lg"`

## Testing After Each Update

1. **Visual Check**
   - Avatar displays correctly
   - Size is appropriate
   - Fallback initials show when no image

2. **Functionality Check**
   - Click interactions still work
   - Hover states work
   - No console errors

3. **Performance Check**
   - Tables load smoothly
   - Lazy loading works (check Network tab)
   - No excessive re-renders

## Common Patterns to Find

### Search Patterns (use Ctrl+F)
1. `<Avatar`
2. `.charAt(0)`
3. `getInitials`
4. `profileImageUrl`

### Replace Patterns

#### Pattern A: Direct Avatar
```javascript
// Find:
<Avatar sx={{ width: X, height: X }}>
  {user.fullName.charAt(0)}
</Avatar>

// Replace:
<UserAvatar user={user} size={X} />
```

#### Pattern B: Avatar with Background Color
```javascript
// Find:
<Avatar sx={{ bgcolor: 'primary.main', width: X, height: X }}>
  {user.fullName.charAt(0)}
</Avatar>

// Replace:
<UserAvatar user={user} size={X} />
// Note: Red gradient is default, no need to specify bgcolor
```

#### Pattern C: Avatar with Upper Case
```javascript
// Find:
<Avatar>
  {user.fullName.charAt(0).toUpperCase()}
</Avatar>

// Replace:
<UserAvatar user={user} size="md" />
// Note: UserAvatar automatically uppercases initials
```

## Validation Script

After updating all components, run this validation:

```bash
# Search for remaining old Avatar patterns
grep -r "Avatar.*charAt" frontend/src/pages/
grep -r "getInitials" frontend/src/pages/
grep -r "import.*Avatar.*from '@mui/material'" frontend/src/pages/

# Should return minimal or no results
```

## Rollback Plan

If issues occur:
1. Git revert specific component: `git checkout HEAD -- frontend/src/pages/ComponentName.jsx`
2. Test the reverted component
3. Fix issues in UserAvatar component
4. Re-apply changes

## Performance Monitoring

After deployment, monitor:
1. **Page Load Time** - Should improve due to lazy loading
2. **Network Requests** - Fewer avatar requests initially
3. **Memory Usage** - Should be stable or improved
4. **Error Logs** - Watch for avatar loading errors

## Support

If you encounter issues:
1. Check `AVATAR_REFACTOR_MIGRATION.md` for troubleshooting
2. Verify UserAvatar component is correctly imported
3. Check browser console for errors
4. Verify user object has `fullName` or `name` property
5. Check MongoDB connection for GridFS avatars

---

**Estimated Time:** 2-3 hours for all components
**Risk Level:** Low (backward compatible)
**Testing Required:** Yes (visual and functional)
