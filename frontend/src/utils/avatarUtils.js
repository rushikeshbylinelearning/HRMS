/**
 * Utility functions for handling avatar/profile image URLs
 */

/**
 * Gets a valid avatar URL from a profile image URL
 * Handles both full URLs and relative paths
 * In development, converts production URLs to relative paths to avoid CORS issues
 * 
 * @param {string|null|undefined} imageUrl - The profile image URL from the backend
 * @returns {string|null} - A valid URL string or null if invalid/empty
 */
export const getAvatarUrl = (imageUrl) => {
  // Return null if no URL provided
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmedUrl = imageUrl.trim();
  
  // Return null if empty after trimming
  if (!trimmedUrl) {
    return null;
  }

  // In development mode, convert production URLs to relative paths
  // This avoids CORS issues when the backend returns production URLs
  if (import.meta.env.DEV) {
    // If it's a production URL, extract the path and make it relative
    if (trimmedUrl.startsWith('https://attendance.bylinelms.com/') || 
        trimmedUrl.startsWith('http://attendance.bylinelms.com/')) {
      // Extract the path part (e.g., /avatars/avatar-123.jpg)
      const urlObj = new URL(trimmedUrl);
      return urlObj.pathname; // Returns /avatars/avatar-123.jpg
    }
    
    // If it's already a relative path, return as-is
    if (trimmedUrl.startsWith('/')) {
      return trimmedUrl;
    }
    
    // If it doesn't start with /, add it
    return `/${trimmedUrl}`;
  }

  // Production mode: handle full URLs and relative paths
  // If it's already a full URL (starts with http:// or https://), return as-is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }

  // If it's a relative path starting with /, construct full URL
  if (trimmedUrl.startsWith('/')) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL 
      ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') // Remove /api suffix if present
      : 'https://attendance.bylinelms.com'; // Default production URL
    
    return `${baseUrl}${trimmedUrl}`;
  }

  // If it doesn't start with /, assume it's a relative path and add /
  return `/${trimmedUrl}`;
};



