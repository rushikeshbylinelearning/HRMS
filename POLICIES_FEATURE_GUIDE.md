# Policies Feature - User Guide

## 🎯 Overview

The Policies feature allows employees to view company policies and submit anonymous feedback, while administrators can manage policies with full version control.

---

## 👤 Employee View

### Accessing Policies

1. **Navigate to Profile Page**
   - Click on your profile or go to `/profile`
   - Look at the **right sidebar**

2. **Policies Section**
   ```
   ┌─────────────────────────────────────┐
   │ Policies & Anonymous Feedback       │
   ├─────────────────────────────────────┤
   │                                     │
   │ Company Policies                    │
   │ ┌─────────────────────────────────┐ │
   │ │ 📄 Employee Handbook            │ │
   │ │    Version: 2.1                 │ │
   │ │    Effective: Jan 15, 2026      │ │
   │ └─────────────────────────────────┘ │
   │ ┌─────────────────────────────────┐ │
   │ │ 📄 Code of Conduct              │ │
   │ │    Version: 1.5                 │ │
   │ │    Effective: Dec 1, 2025       │ │
   │ └─────────────────────────────────┘ │
   │                                     │
   │ ─────────────────────────────────── │
   │                                     │
   │ Anonymous Message                   │
   │ ┌─────────────────────────────────┐ │
   │ │ Write your feedback here...     │ │
   │ │                                 │ │
   │ │                                 │ │
   │ └─────────────────────────────────┘ │
   │ [Submit Anonymously]                │
   └─────────────────────────────────────┘
   ```

3. **Viewing a Policy**
   - Click on any policy in the list
   - PDF opens in the same area (embedded viewer)
   - Click "Close" to return to the list

4. **Submitting Anonymous Feedback**
   - Scroll to "Anonymous Message" section
   - Type your feedback
   - Click "Submit Anonymously"
   - Your identity is NOT recorded

### Features Available to Employees
- ✅ View all active policies
- ✅ Read policies in embedded PDF viewer
- ✅ Submit anonymous feedback
- ❌ No download option
- ❌ No edit/delete access

---

## 👨‍💼 Admin View

### Accessing Policy Management

1. **Navigate to Admin Panel**
   - Click "Policies & CIF" in the sidebar
   - Or go to `/admin/policies`

2. **Admin Dashboard Layout**
   ```
   ┌──────────────────────────────────────────────────────┐
   │         Policies Management                          │
   │  Upload, manage, and version control company policies│
   ├──────────────────────────────────────────────────────┤
   │                                                      │
   │ Upload New Policy                                    │
   │ ┌──────────────────────────────────────────────────┐ │
   │ │ [Select PDF File]                                │ │
   │ │                                                  │ │
   │ │ Policy Name: [________________]                  │ │
   │ │ Version: [____] ☑ Auto-generate                 │ │
   │ │ Effective From: [Date Picker]                    │ │
   │ │ Department: [________________] (Optional)        │ │
   │ │ Status: [Active ▼]                               │ │
   │ │                                                  │ │
   │ │ [Upload Policy]                                  │ │
   │ └──────────────────────────────────────────────────┘ │
   │                                                      │
   │ Existing Policies                                    │
   │ ┌──────────────────────────────────────────────────┐ │
   │ │ Name          │ Ver │ Date    │ Dept │ Status   │ │
   │ ├──────────────────────────────────────────────────┤ │
   │ │ Handbook      │ 2.1 │ Jan 15  │ HR   │ Active   │ │
   │ │ Code Conduct  │ 1.5 │ Dec 1   │ All  │ Active   │ │
   │ │ Leave Policy  │ 3.0 │ Nov 20  │ HR   │ Archived │ │
   │ └──────────────────────────────────────────────────┘ │
   └──────────────────────────────────────────────────────┘
   ```

### Uploading a New Policy

1. **Select PDF File**
   - Click "Select PDF File" button
   - Choose a PDF document
   - Only PDF files are accepted

2. **Fill Policy Details**
   - **Policy Name**: Enter descriptive name
   - **Version**: Enter manually OR enable auto-generate
   - **Effective From**: Select date when policy takes effect
   - **Department**: (Optional) Specify department
   - **Status**: Choose Active or Archived

3. **Submit**
   - Click "Upload Policy"
   - Policy appears in the table below

### Managing Existing Policies

#### View Policy
- Click the 👁️ (eye) icon
- PDF opens in a dialog
- Close dialog to return

#### Replace Policy
- Click the 🔄 (swap) icon
- Upload new PDF file
- New version is created automatically
- Old version is marked as "Archived"
- New version becomes "Active"

#### Delete Policy
- Click the 🗑️ (trash) icon
- Confirm deletion
- Policy and file are permanently removed

### Version Control Logic

**Example: Replacing a Policy**

Before Replace:
```
Employee Handbook v2.1 (Active)
```

After Replace:
```
Employee Handbook v2.2 (Active)  ← New version
Employee Handbook v2.1 (Archived) ← Old version
```

**Auto-Version Generation:**
- If current version is `2.1`, next version is `2.2`
- If current version is `1.9`, next version is `2.0`
- First version defaults to `1.0`

---

## 🔐 Security & Privacy

### Anonymous Feedback
- ✅ No user ID stored
- ✅ No email stored
- ✅ No employee code stored
- ⚠️ IP address stored (for abuse prevention)
- ⚠️ Browser info stored (for abuse prevention)

### Access Control
- **Employees**: Read-only access to policies
- **Admins**: Full CRUD access to policies
- **Authentication**: Required for all endpoints

### File Validation
- ✅ Only PDF files accepted
- ✅ 10MB file size limit
- ✅ Secure file storage
- ✅ Unique file naming

---

## 📱 Responsive Design

### Desktop (1200px+)
- Two-column layout on Profile page
- Full-width table on Admin page

### Tablet (768px - 1199px)
- Stacked layout on Profile page
- Scrollable table on Admin page

### Mobile (< 768px)
- Single column layout
- Touch-friendly buttons
- Scrollable policy list

---

## 🎨 UI Components

### Policy List Item
```
┌─────────────────────────────────────┐
│ 📄 Employee Handbook                │
│    Version: 2.1 • Effective: Jan 15 │
│    Dept: HR                         │
│                          [Active]   │
└─────────────────────────────────────┘
```

### PDF Viewer
```
┌─────────────────────────────────────┐
│ Employee Handbook v2.1         [X]  │
│ Version 2.1 • Effective from Jan 15 │
├─────────────────────────────────────┤
│                                     │
│     [PDF Content Displayed Here]    │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### Anonymous Feedback Box
```
┌─────────────────────────────────────┐
│ Anonymous Message                   │
│ Your identity will not be recorded  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Write your feedback here...     │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Submit Anonymously]                │
└─────────────────────────────────────┘
```

---

## 🚀 Quick Start

### For Employees
1. Go to Profile page
2. Look at right sidebar
3. Click any policy to view
4. Submit feedback below

### For Admins
1. Click "Policies & CIF" in sidebar
2. Upload new policies using form
3. Manage existing policies in table
4. Replace policies to create new versions

---

## 💡 Tips & Best Practices

### For Admins
- Use descriptive policy names
- Enable auto-version for consistency
- Set effective dates accurately
- Archive old policies instead of deleting
- Review anonymous feedback regularly

### For Employees
- Read policies carefully
- Check effective dates
- Use anonymous feedback for sensitive issues
- Be constructive in feedback

---

## 🐛 Troubleshooting

### PDF Not Loading
- Check file size (max 10MB)
- Ensure file is valid PDF
- Try refreshing the page

### Upload Failed
- Verify file is PDF format
- Check all required fields
- Ensure you have admin access

### Anonymous Feedback Not Submitting
- Check message is not empty
- Verify internet connection
- Try again after a moment

---

## 📞 Support

For technical issues or questions:
- Contact IT Support
- Email: support@company.com
- Internal Ticket System

---

**Last Updated**: February 10, 2026
**Version**: 1.0
