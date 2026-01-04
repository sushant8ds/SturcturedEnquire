/**
 * Salary Calculation Utilities
 * 
 * This module provides core business logic functions for salary calculations,
 * payment status determination, and input validation for the Salary Tracker System.
 */

/**
 * Calculates the remaining salary payable after deducting advance payments
 * 
 * @param {number} totalMonthlySalary - The total monthly salary amount
 * @param {number} advanceAmountPaid - The advance amount already paid
 * @returns {number} The remaining salary amount to be paid
 * @throws {Error} If inputs are invalid
 */
function calculateRemainingSalary(totalMonthlySalary, advanceAmountPaid) {
  // Input validation
  if (typeof totalMonthlySalary !== 'number' || typeof advanceAmountPaid !== 'number') {
    throw new Error('Salary amounts must be numbers');
  }

  if (totalMonthlySalary < 0) {
    throw new Error('Total monthly salary cannot be negative');
  }

  if (advanceAmountPaid < 0) {
    throw new Error('Advance amount paid cannot be negative');
  }

  if (advanceAmountPaid > totalMonthlySalary) {
    throw new Error('Advance amount cannot exceed total monthly salary');
  }

  // Ensure monetary precision (round to 2 decimal places)
  const remaining = totalMonthlySalary - advanceAmountPaid;
  return Math.round(remaining * 100) / 100;
}

/**
 * Determines the payment status based on salary amounts
 * 
 * Business Rules:
 * - "Paid": remaining salary = 0
 * - "Partially Paid": advance > 0 and remaining > 0
 * - "Pending": advance = 0
 * 
 * @param {number} totalMonthlySalary - The total monthly salary amount
 * @param {number} advanceAmountPaid - The advance amount already paid
 * @returns {string} Payment status: "Pending", "Partially Paid", or "Paid"
 * @throws {Error} If inputs are invalid
 */
function determinePaymentStatus(totalMonthlySalary, advanceAmountPaid) {
  // Input validation (reuse calculation validation)
  const remainingSalary = calculateRemainingSalary(totalMonthlySalary, advanceAmountPaid);

  // Apply business rules for payment status
  if (remainingSalary === 0) {
    return 'Paid';
  } else if (advanceAmountPaid > 0 && remainingSalary > 0) {
    return 'Partially Paid';
  } else if (advanceAmountPaid === 0) {
    return 'Pending';
  }

  // This should never happen with valid inputs, but included for completeness
  throw new Error('Unable to determine payment status with given inputs');
}

/**
 * Validates monetary amounts for precision and business rules
 * 
 * @param {number} amount - The monetary amount to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {boolean} True if valid
 * @throws {Error} If amount is invalid
 */
function validateMonetaryAmount(amount, fieldName = 'amount') {
  if (typeof amount !== 'number') {
    throw new Error(`${fieldName} must be a number`);
  }

  if (!Number.isFinite(amount)) {
    throw new Error(`${fieldName} must be a finite number`);
  }

  if (amount < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }

  // Check for reasonable monetary precision (2 decimal places)
  const rounded = Math.round(amount * 100) / 100;
  if (Math.abs(amount - rounded) > 0.001) {
    throw new Error(`${fieldName} must have at most 2 decimal places`);
  }

  return true;
}

/**
 * Validates advance amount against total salary
 * 
 * @param {number} totalMonthlySalary - The total monthly salary
 * @param {number} advanceAmountPaid - The advance amount to validate
 * @returns {boolean} True if valid
 * @throws {Error} If advance amount is invalid
 */
function validateAdvanceAmount(totalMonthlySalary, advanceAmountPaid) {
  // Validate individual amounts first
  validateMonetaryAmount(totalMonthlySalary, 'Total monthly salary');
  validateMonetaryAmount(advanceAmountPaid, 'Advance amount paid');

  // Check business rule: advance cannot exceed total salary
  if (advanceAmountPaid > totalMonthlySalary) {
    throw new Error('Advance amount cannot exceed total monthly salary');
  }

  return true;
}

/**
 * Comprehensive salary calculation with validation
 * 
 * This function combines all salary calculations and validations into a single
 * operation, returning a complete salary calculation result.
 * 
 * @param {Object} salaryData - Salary calculation input
 * @param {number} salaryData.totalMonthlySalary - Total monthly salary
 * @param {number} salaryData.advanceAmountPaid - Advance amount paid
 * @returns {Object} Complete salary calculation result
 * @throws {Error} If inputs are invalid
 */
function calculateSalaryDetails(salaryData) {
  const { totalMonthlySalary, advanceAmountPaid } = salaryData;

  // Validate inputs
  validateAdvanceAmount(totalMonthlySalary, advanceAmountPaid);

  // Perform calculations
  const remainingSalaryPayable = calculateRemainingSalary(totalMonthlySalary, advanceAmountPaid);
  const paymentStatus = determinePaymentStatus(totalMonthlySalary, advanceAmountPaid);

  return {
    totalMonthlySalary,
    advanceAmountPaid,
    remainingSalaryPayable,
    paymentStatus,
    calculatedAt: new Date()
  };
}

/**
 * Formats monetary amounts for display
 * 
 * @param {number} amount - The monetary amount to format
 * @param {string} currency - Currency symbol (default: '₹')
 * @returns {string} Formatted amount string
 */
function formatCurrency(amount, currency = '₹') {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return `${currency}0.00`;
  }
  
  return `${currency}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Calculates percentage of salary paid as advance
 * 
 * @param {number} totalMonthlySalary - Total monthly salary
 * @param {number} advanceAmountPaid - Advance amount paid
 * @returns {number} Percentage of salary paid as advance (0-100)
 */
function calculateAdvancePercentage(totalMonthlySalary, advanceAmountPaid) {
  validateAdvanceAmount(totalMonthlySalary, advanceAmountPaid);

  if (totalMonthlySalary === 0) {
    return 0;
  }

  const percentage = (advanceAmountPaid / totalMonthlySalary) * 100;
  return Math.round(percentage * 100) / 100; // Round to 2 decimal places
}

/**
 * Checks if a salary record represents a full payment
 * 
 * @param {number} totalMonthlySalary - Total monthly salary
 * @param {number} advanceAmountPaid - Advance amount paid
 * @returns {boolean} True if fully paid
 */
function isFullyPaid(totalMonthlySalary, advanceAmountPaid) {
  const remaining = calculateRemainingSalary(totalMonthlySalary, advanceAmountPaid);
  return remaining === 0;
}

/**
 * Checks if a salary record has any advance payment
 * 
 * @param {number} advanceAmountPaid - Advance amount paid
 * @returns {boolean} True if advance payment exists
 */
function hasAdvancePayment(advanceAmountPaid) {
  validateMonetaryAmount(advanceAmountPaid, 'Advance amount paid');
  return advanceAmountPaid > 0;
}

module.exports = {
  calculateRemainingSalary,
  determinePaymentStatus,
  validateMonetaryAmount,
  validateAdvanceAmount,
  calculateSalaryDetails,
  formatCurrency,
  calculateAdvancePercentage,
  isFullyPaid,
  hasAdvancePayment
};