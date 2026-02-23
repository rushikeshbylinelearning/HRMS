/**
 * FILTER CONTROLS COMPONENT
 * 
 * Provides filtering interface for attendance analytics.
 * Includes date range picker and various filter dropdowns.
 */

import React, { useState, useEffect } from 'react';
import { getISTDateString, getISTNow } from '../../utils/istTime';
import './FilterControls.css';

function FilterControls({ filters, onFilterChange }) {
    const [localFilters, setLocalFilters] = useState(filters);
    
    // Get default date range (current month)
    const getDefaultDateRange = () => {
        const now = getISTNow();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const endDate = getISTDateString(now);
        return { startDate, endDate };
    };
    
    useEffect(() => {
        // Initialize with default dates if not provided
        if (!filters.startDate || !filters.endDate) {
            const defaultRange = getDefaultDateRange();
            setLocalFilters(prev => ({
                ...prev,
                ...defaultRange
            }));
        }
    }, []);
    
    const handleChange = (field, value) => {
        setLocalFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };
    
    const handleApplyFilters = () => {
        onFilterChange(localFilters);
    };
    
    const handleClearFilters = () => {
        const defaultRange = getDefaultDateRange();
        const clearedFilters = {
            startDate: defaultRange.startDate,
            endDate: defaultRange.endDate,
            department: '',
            location: '',
            shiftType: '',
            employmentStatus: ''
        };
        setLocalFilters(clearedFilters);
        onFilterChange(clearedFilters);
    };
    
    return (
        <div className="filter-controls">
            <div className="filter-header">
                <h3>Filters</h3>
            </div>
            
            <div className="filter-grid">
                <div className="filter-group">
                    <label htmlFor="startDate">Start Date</label>
                    <input
                        type="date"
                        id="startDate"
                        value={localFilters.startDate || ''}
                        onChange={(e) => handleChange('startDate', e.target.value)}
                        className="filter-input"
                    />
                </div>
                
                <div className="filter-group">
                    <label htmlFor="endDate">End Date</label>
                    <input
                        type="date"
                        id="endDate"
                        value={localFilters.endDate || ''}
                        onChange={(e) => handleChange('endDate', e.target.value)}
                        className="filter-input"
                    />
                </div>
                
                <div className="filter-group">
                    <label htmlFor="department">Department</label>
                    <input
                        type="text"
                        id="department"
                        value={localFilters.department || ''}
                        onChange={(e) => handleChange('department', e.target.value)}
                        placeholder="Enter department"
                        className="filter-input"
                    />
                </div>
                
                <div className="filter-group">
                    <label htmlFor="shiftType">Shift Type</label>
                    <select
                        id="shiftType"
                        value={localFilters.shiftType || ''}
                        onChange={(e) => handleChange('shiftType', e.target.value)}
                        className="filter-input"
                    >
                        <option value="">All</option>
                        <option value="Fixed">Fixed</option>
                        <option value="Flexible">Flexible</option>
                    </select>
                </div>
                
                <div className="filter-group">
                    <label htmlFor="employmentStatus">Employment Status</label>
                    <select
                        id="employmentStatus"
                        value={localFilters.employmentStatus || ''}
                        onChange={(e) => handleChange('employmentStatus', e.target.value)}
                        className="filter-input"
                    >
                        <option value="">All</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
            </div>
            
            <div className="filter-actions">
                <button onClick={handleApplyFilters} className="btn-apply">
                    Apply Filters
                </button>
                <button onClick={handleClearFilters} className="btn-clear">
                    Clear Filters
                </button>
            </div>
        </div>
    );
}

export default FilterControls;
