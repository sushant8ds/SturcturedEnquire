/**
 * SalaryTracker React Component
 * 
 * Main component for the Salary Tracker Management System frontend.
 * Provides functionality to add new salary records and view existing ones
 * with real-time calculations and dynamic payment status updates.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SalaryTracker.css';

const SalaryTracker = () => {
  // State for salary records array
  const [salaryRecords, setSalaryRecords] = useState([]);
  
  // State for form inputs
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    month: '',
    year: new Date().getFullYear(),
    totalMonthlySalary: '',
    advanceAmountPaid: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });

  // State for calculated values (real-time)
  const [calculatedValues, setCalculatedValues] = useState({
    remainingSalary: 0,
    paymentStatus: 'Pending'
  });

  // State for loading and error handling
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // State for theme toggle (day/night mode)
  const [isDarkMode, setIsDarkMode] = useState(false);

  // State for delete confirmation modal
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    recordId: null,
    employeeName: '',
    isDeleting: false
  });

  // Month options for dropdown
  const months = [
    { value: 1, name: 'January' },
    { value: 2, name: 'February' },
    { value: 3, name: 'March' },
    { value: 4, name: 'April' },
    { value: 5, name: 'May' },
    { value: 6, name: 'June' },
    { value: 7, name: 'July' },
    { value: 8, name: 'August' },
    { value: 9, name: 'September' },
    { value: 10, name: 'October' },
    { value: 11, name: 'November' },
    { value: 12, name: 'December' }
  ];

  // Load existing salary records on component mount
  useEffect(() => {
    fetchSalaryRecords();
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('salaryTrackerTheme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
  }, []);

  // Real-time calculation when salary amounts change
  useEffect(() => {
    calculateRealTimeValues();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.totalMonthlySalary, formData.advanceAmountPaid]);

  /**
   * Fetch salary records from the API
   */
  const fetchSalaryRecords = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/salaries');
      setSalaryRecords(response.data.data || []);
    } catch (err) {
      setError('Failed to load salary records');
      console.error('Error fetching salary records:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate remaining salary and payment status in real-time
   */
  const calculateRealTimeValues = () => {
    const totalSalary = parseFloat(formData.totalMonthlySalary) || 0;
    const advanceAmount = parseFloat(formData.advanceAmountPaid) || 0;

    // Validate amounts
    if (totalSalary < 0 || advanceAmount < 0) {
      setCalculatedValues({
        remainingSalary: 0,
        paymentStatus: 'Invalid'
      });
      return;
    }

    if (advanceAmount > totalSalary) {
      setCalculatedValues({
        remainingSalary: 0,
        paymentStatus: 'Invalid - Advance exceeds total'
      });
      return;
    }

    // Calculate remaining salary
    const remainingSalary = totalSalary - advanceAmount;

    // Determine payment status
    let paymentStatus;
    if (remainingSalary === 0 && totalSalary > 0) {
      paymentStatus = 'Paid';
    } else if (advanceAmount > 0 && remainingSalary > 0) {
      paymentStatus = 'Partially Paid';
    } else if (advanceAmount === 0) {
      paymentStatus = 'Pending';
    } else {
      paymentStatus = 'Pending';
    }

    setCalculatedValues({
      remainingSalary: Math.round(remainingSalary * 100) / 100,
      paymentStatus
    });
  };

  /**
   * Handle form input changes
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Validate required fields
      if (!formData.employeeId || !formData.employeeName || !formData.month || 
          !formData.totalMonthlySalary || formData.advanceAmountPaid === '') {
        setError('Please fill in all required fields');
        return;
      }

      // Prepare data for API
      const apiData = {
        ...formData,
        month: parseInt(formData.month),
        year: parseInt(formData.year),
        totalMonthlySalary: parseFloat(formData.totalMonthlySalary),
        advanceAmountPaid: parseFloat(formData.advanceAmountPaid),
        paymentDate: new Date(formData.paymentDate).toISOString()
      };

      // Submit to API
      const response = await axios.post('/api/addSalary', apiData);
      
      // Add new record to local state
      setSalaryRecords(prev => [response.data.data, ...prev]);
      
      // Reset form
      setFormData({
        employeeId: '',
        employeeName: '',
        month: '',
        year: new Date().getFullYear(),
        totalMonthlySalary: '',
        advanceAmountPaid: '',
        paymentDate: new Date().toISOString().split('T')[0]
      });

      setSuccess('Salary record added successfully!');

    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to add salary record';
      setError(errorMessage);
      console.error('Error adding salary record:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggle between day and night mode
   */
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('salaryTrackerTheme', newTheme ? 'dark' : 'light');
  };

  /**
   * Open delete confirmation modal
   */
  const openDeleteModal = (record) => {
    setDeleteModal({
      isOpen: true,
      recordId: record._id,
      employeeName: record.employeeName,
      isDeleting: false
    });
  };

  /**
   * Close delete confirmation modal
   */
  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      recordId: null,
      employeeName: '',
      isDeleting: false
    });
  };

  /**
   * Delete salary record
   */
  const deleteSalaryRecord = async () => {
    try {
      setDeleteModal(prev => ({ ...prev, isDeleting: true }));
      setError(''); // Clear any previous errors
      
      console.log('Deleting record with ID:', deleteModal.recordId);
      
      const response = await axios.delete(`/api/salaries/${deleteModal.recordId}`);
      
      console.log('Delete response:', response.data);
      
      // Remove the deleted record from local state
      setSalaryRecords(prev => prev.filter(record => record._id !== deleteModal.recordId));
      
      setSuccess(`Salary record for ${deleteModal.employeeName} deleted successfully!`);
      closeDeleteModal();
      
    } catch (err) {
      console.error('Delete error:', err);
      const errorMessage = err.response?.data?.error || 'Failed to delete salary record';
      setError(errorMessage);
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  /**
   * Format currency for display
   */
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  /**
   * Get status badge class for styling
   */
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Paid':
        return 'status-badge status-paid';
      case 'Partially Paid':
        return 'status-badge status-partial';
      case 'Pending':
        return 'status-badge status-pending';
      default:
        return 'status-badge status-invalid';
    }
  };

  return (
    <div className={`salary-tracker ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      <header className="salary-tracker-header">
        <div className="header-content">
          <div className="header-text">
            <h1>💰 Salary Tracker Management System</h1>
            <p>Track employee salaries, advance payments, and payment status (₹)</p>
          </div>
          <div className="theme-toggle">
            <button 
              onClick={toggleTheme} 
              className="theme-toggle-btn"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? '☀️' : '🌙'}
              <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Add New Salary Record Form */}
      <section className="add-salary-section">
        <h2>Add New Salary Record</h2>
        
        <form onSubmit={handleSubmit} className="salary-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="employeeId">Employee ID *</label>
              <input
                type="text"
                id="employeeId"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleInputChange}
                placeholder="e.g., EMP001"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="employeeName">Employee Name *</label>
              <input
                type="text"
                id="employeeName"
                name="employeeName"
                value={formData.employeeName}
                onChange={handleInputChange}
                placeholder="e.g., John Doe"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="month">Month *</label>
              <select
                id="month"
                name="month"
                value={formData.month}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Month</option>
                {months.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="year">Year *</label>
              <input
                type="number"
                id="year"
                name="year"
                value={formData.year}
                onChange={handleInputChange}
                min="2020"
                max="2030"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="totalMonthlySalary">Total Monthly Salary (₹) *</label>
              <input
                type="number"
                id="totalMonthlySalary"
                name="totalMonthlySalary"
                value={formData.totalMonthlySalary}
                onChange={handleInputChange}
                placeholder="50000.00"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="advanceAmountPaid">Advance Amount Paid (₹) *</label>
              <input
                type="number"
                id="advanceAmountPaid"
                name="advanceAmountPaid"
                value={formData.advanceAmountPaid}
                onChange={handleInputChange}
                placeholder="20000.00"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="paymentDate">Payment Date *</label>
              <input
                type="date"
                id="paymentDate"
                name="paymentDate"
                value={formData.paymentDate}
                onChange={handleInputChange}
                required
              />
            </div>

            {/* Real-time calculation display */}
            <div className="form-group calculation-display">
              <div className="calculation-item">
                <label>Remaining Salary (₹):</label>
                <span className="calculated-value">
                  {formatCurrency(calculatedValues.remainingSalary)}
                </span>
              </div>
              <div className="calculation-item">
                <label>Payment Status:</label>
                <span className={getStatusBadgeClass(calculatedValues.paymentStatus)}>
                  {calculatedValues.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Salary Record'}
            </button>
          </div>
        </form>

        {/* Success/Error Messages */}
        {error && <div className="message error-message">{error}</div>}
        {success && <div className="message success-message">{success}</div>}
      </section>

      {/* Salary Records Display */}
      <section className="salary-records-section">
        <h2>Salary Records ({salaryRecords.length})</h2>
        
        {loading && <div className="loading">Loading salary records...</div>}
        
        {salaryRecords.length === 0 && !loading ? (
          <div className="no-records">
            <p>No salary records found. Add your first record above!</p>
          </div>
        ) : (
          <div className="salary-table-container">
            <table className="salary-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Total Salary</th>
                  <th>Advance Paid</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th>Payment Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {salaryRecords.map((record) => (
                  <tr key={record._id}>
                    <td>
                      <div className="employee-info">
                        <div className="employee-name">{record.employeeName}</div>
                        <div className="employee-id">{record.employeeId}</div>
                      </div>
                    </td>
                    <td>
                      <div className="period-info">
                        {record.month} {record.year}
                      </div>
                    </td>
                    <td className="amount">
                      {formatCurrency(record.totalMonthlySalary)}
                    </td>
                    <td className="amount">
                      {formatCurrency(record.advanceAmountPaid)}
                    </td>
                    <td className="amount">
                      {formatCurrency(record.remainingSalaryPayable)}
                    </td>
                    <td>
                      <span className={getStatusBadgeClass(record.paymentStatus)}>
                        {record.paymentStatus}
                      </span>
                    </td>
                    <td>
                      {formatDate(record.paymentDate)}
                    </td>
                    <td>
                      <button
                        onClick={() => openDeleteModal(record)}
                        className="delete-btn"
                        title={`Delete salary record for ${record.employeeName}`}
                        disabled={loading}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>🗑️ Confirm Delete</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete the salary record for:</p>
              <div className="delete-employee-info">
                <strong>{deleteModal.employeeName}</strong>
              </div>
              <p className="warning-text">⚠️ This action cannot be undone!</p>
            </div>
            <div className="modal-actions">
              <button
                onClick={closeDeleteModal}
                className="cancel-btn"
                disabled={deleteModal.isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={deleteSalaryRecord}
                className="confirm-delete-btn"
                disabled={deleteModal.isDeleting}
              >
                {deleteModal.isDeleting ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryTracker;