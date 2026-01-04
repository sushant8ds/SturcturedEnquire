const {
  calculateRemainingSalary,
  determinePaymentStatus,
  validateMonetaryAmount,
  validateAdvanceAmount,
  calculateSalaryDetails,
  formatCurrency,
  calculateAdvancePercentage,
  isFullyPaid,
  hasAdvancePayment
} = require('../../utils/salaryCalculations');

describe('Salary Calculation Functions', () => {
  describe('calculateRemainingSalary', () => {
    test('should calculate remaining salary correctly', () => {
      expect(calculateRemainingSalary(5000, 2000)).toBe(3000);
      expect(calculateRemainingSalary(4500.50, 1500.25)).toBe(3000.25);
      expect(calculateRemainingSalary(1000, 1000)).toBe(0);
      expect(calculateRemainingSalary(2500, 0)).toBe(2500);
    });

    test('should handle decimal precision correctly', () => {
      expect(calculateRemainingSalary(1000.99, 500.49)).toBe(500.50);
      expect(calculateRemainingSalary(3333.33, 1111.11)).toBe(2222.22);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => calculateRemainingSalary('5000', 2000)).toThrow('Salary amounts must be numbers');
      expect(() => calculateRemainingSalary(5000, '2000')).toThrow('Salary amounts must be numbers');
      expect(() => calculateRemainingSalary(-5000, 2000)).toThrow('Total monthly salary cannot be negative');
      expect(() => calculateRemainingSalary(5000, -2000)).toThrow('Advance amount paid cannot be negative');
      expect(() => calculateRemainingSalary(3000, 5000)).toThrow('Advance amount cannot exceed total monthly salary');
    });
  });

  describe('determinePaymentStatus', () => {
    test('should return "Paid" when remaining salary is zero', () => {
      expect(determinePaymentStatus(5000, 5000)).toBe('Paid');
      expect(determinePaymentStatus(1000, 1000)).toBe('Paid');
    });

    test('should return "Partially Paid" when advance > 0 and remaining > 0', () => {
      expect(determinePaymentStatus(5000, 2000)).toBe('Partially Paid');
      expect(determinePaymentStatus(3000, 1500)).toBe('Partially Paid');
    });

    test('should return "Pending" when advance is zero', () => {
      expect(determinePaymentStatus(5000, 0)).toBe('Pending');
      expect(determinePaymentStatus(1000, 0)).toBe('Pending');
    });

    test('should throw error for invalid inputs', () => {
      expect(() => determinePaymentStatus(-5000, 2000)).toThrow();
      expect(() => determinePaymentStatus(3000, 5000)).toThrow();
    });
  });

  describe('validateMonetaryAmount', () => {
    test('should return true for valid amounts', () => {
      expect(validateMonetaryAmount(5000)).toBe(true);
      expect(validateMonetaryAmount(0)).toBe(true);
      expect(validateMonetaryAmount(1000.50)).toBe(true);
      expect(validateMonetaryAmount(999.99)).toBe(true);
    });

    test('should throw error for invalid amounts', () => {
      expect(() => validateMonetaryAmount('5000')).toThrow('amount must be a number');
      expect(() => validateMonetaryAmount(-100)).toThrow('amount cannot be negative');
      expect(() => validateMonetaryAmount(Infinity)).toThrow('amount must be a finite number');
      expect(() => validateMonetaryAmount(NaN)).toThrow('amount must be a finite number');
      expect(() => validateMonetaryAmount(100.123)).toThrow('amount must have at most 2 decimal places');
    });

    test('should use custom field name in error messages', () => {
      expect(() => validateMonetaryAmount(-100, 'salary')).toThrow('salary cannot be negative');
    });
  });

  describe('validateAdvanceAmount', () => {
    test('should return true for valid advance amounts', () => {
      expect(validateAdvanceAmount(5000, 2000)).toBe(true);
      expect(validateAdvanceAmount(5000, 0)).toBe(true);
      expect(validateAdvanceAmount(5000, 5000)).toBe(true);
    });

    test('should throw error when advance exceeds total salary', () => {
      expect(() => validateAdvanceAmount(3000, 5000)).toThrow('Advance amount cannot exceed total monthly salary');
    });

    test('should throw error for invalid monetary amounts', () => {
      expect(() => validateAdvanceAmount(-5000, 2000)).toThrow('Total monthly salary cannot be negative');
      expect(() => validateAdvanceAmount(5000, -2000)).toThrow('Advance amount paid cannot be negative');
    });
  });

  describe('calculateSalaryDetails', () => {
    test('should return complete salary calculation', () => {
      const result = calculateSalaryDetails({
        totalMonthlySalary: 5000,
        advanceAmountPaid: 2000
      });

      expect(result.totalMonthlySalary).toBe(5000);
      expect(result.advanceAmountPaid).toBe(2000);
      expect(result.remainingSalaryPayable).toBe(3000);
      expect(result.paymentStatus).toBe('Partially Paid');
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });

    test('should handle different payment scenarios', () => {
      // Fully paid
      const fullPaid = calculateSalaryDetails({
        totalMonthlySalary: 4000,
        advanceAmountPaid: 4000
      });
      expect(fullPaid.paymentStatus).toBe('Paid');
      expect(fullPaid.remainingSalaryPayable).toBe(0);

      // Pending
      const pending = calculateSalaryDetails({
        totalMonthlySalary: 3000,
        advanceAmountPaid: 0
      });
      expect(pending.paymentStatus).toBe('Pending');
      expect(pending.remainingSalaryPayable).toBe(3000);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => calculateSalaryDetails({
        totalMonthlySalary: 3000,
        advanceAmountPaid: 5000
      })).toThrow('Advance amount cannot exceed total monthly salary');
    });
  });

  describe('formatCurrency', () => {
    test('should format currency correctly', () => {
      expect(formatCurrency(50000)).toBe('₹50,000.00');
      expect(formatCurrency(1234.56)).toBe('₹1,234.56');
      expect(formatCurrency(0)).toBe('₹0.00');
      expect(formatCurrency(999.9)).toBe('₹999.90');
    });

    test('should handle custom currency symbols', () => {
      expect(formatCurrency(50000, '₹')).toBe('₹50,000.00');
      expect(formatCurrency(1234.56, 'Rs.')).toBe('Rs.1,234.56');
    });

    test('should handle invalid inputs gracefully', () => {
      expect(formatCurrency('invalid')).toBe('₹0.00');
      expect(formatCurrency(NaN)).toBe('$0.00');
      expect(formatCurrency(Infinity)).toBe('$0.00');
    });
  });

  describe('calculateAdvancePercentage', () => {
    test('should calculate advance percentage correctly', () => {
      expect(calculateAdvancePercentage(5000, 2500)).toBe(50);
      expect(calculateAdvancePercentage(1000, 250)).toBe(25);
      expect(calculateAdvancePercentage(4000, 1000)).toBe(25);
      expect(calculateAdvancePercentage(3000, 0)).toBe(0);
    });

    test('should handle decimal precision', () => {
      expect(calculateAdvancePercentage(3000, 1000)).toBe(33.33);
      expect(calculateAdvancePercentage(7000, 2333.33)).toBe(33.33);
    });

    test('should handle zero total salary', () => {
      expect(calculateAdvancePercentage(0, 0)).toBe(0);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => calculateAdvancePercentage(3000, 5000)).toThrow();
    });
  });

  describe('isFullyPaid', () => {
    test('should return true when fully paid', () => {
      expect(isFullyPaid(5000, 5000)).toBe(true);
      expect(isFullyPaid(1000, 1000)).toBe(true);
    });

    test('should return false when not fully paid', () => {
      expect(isFullyPaid(5000, 2000)).toBe(false);
      expect(isFullyPaid(5000, 0)).toBe(false);
    });
  });

  describe('hasAdvancePayment', () => {
    test('should return true when advance payment exists', () => {
      expect(hasAdvancePayment(1000)).toBe(true);
      expect(hasAdvancePayment(0.01)).toBe(true);
    });

    test('should return false when no advance payment', () => {
      expect(hasAdvancePayment(0)).toBe(false);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => hasAdvancePayment(-100)).toThrow();
    });
  });

  // Edge cases and integration tests
  describe('Edge Cases', () => {
    test('should handle very small amounts', () => {
      expect(calculateRemainingSalary(0.01, 0.01)).toBe(0);
      expect(determinePaymentStatus(0.01, 0.01)).toBe('Paid');
    });

    test('should handle large amounts', () => {
      expect(calculateRemainingSalary(1000000, 500000)).toBe(500000);
      expect(determinePaymentStatus(1000000, 500000)).toBe('Partially Paid');
    });

    test('should maintain precision across calculations', () => {
      const salary = 3333.33;
      const advance = 1111.11;
      const remaining = calculateRemainingSalary(salary, advance);
      const status = determinePaymentStatus(salary, advance);
      
      expect(remaining).toBe(2222.22);
      expect(status).toBe('Partially Paid');
    });
  });
});

const fc = require('fast-check');

/**
 * Property 1: Salary calculation accuracy
 * Feature: salary-tracker-system, Property 1: Salary calculation accuracy
 * Validates: Requirements 2.1, 7.1
 */
describe('Property 1: Salary calculation accuracy', () => {
  // Property test generators for salary calculations
  const validSalaryGen = fc.integer({ min: 0, max: 10000000 }).map(n => n / 100); // Convert cents to dollars
  
  const validSalaryAdvancePairGen = fc.record({
    totalSalary: validSalaryGen,
  }).chain(base => 
    fc.record({
      totalSalary: fc.constant(base.totalSalary),
      advanceAmount: fc.integer({ min: 0, max: Math.round(base.totalSalary * 100) }).map(n => n / 100)
    })
  );

  test('should calculate remaining salary correctly for any valid inputs', () => {
    fc.assert(fc.property(validSalaryAdvancePairGen, ({ totalSalary, advanceAmount }) => {
      const remaining = calculateRemainingSalary(totalSalary, advanceAmount);
      
      // Property: Remaining salary should always equal total minus advance
      const expectedRemaining = Math.round((totalSalary - advanceAmount) * 100) / 100;
      expect(remaining).toBe(expectedRemaining);
      
      // Property: Remaining salary should never be negative
      expect(remaining).toBeGreaterThanOrEqual(0);
      
      // Property: Remaining salary should be at most the total salary
      expect(remaining).toBeLessThanOrEqual(totalSalary);
      
      // Property: If advance is zero, remaining should equal total
      if (advanceAmount === 0) {
        expect(remaining).toBe(totalSalary);
      }
      
      // Property: If advance equals total, remaining should be zero
      if (Math.abs(advanceAmount - totalSalary) < 0.005) {
        expect(remaining).toBeLessThan(0.005);
      }
      
      // Property: Remaining should have at most 2 decimal places (accounting for floating point precision)
      expect(Math.abs(Math.round(remaining * 100) - (remaining * 100))).toBeLessThan(0.0001);
    }), { numRuns: 100 });
  });

  test('should maintain calculation consistency across multiple operations', () => {
    fc.assert(fc.property(validSalaryAdvancePairGen, ({ totalSalary, advanceAmount }) => {
      // Calculate remaining salary multiple times
      const remaining1 = calculateRemainingSalary(totalSalary, advanceAmount);
      const remaining2 = calculateRemainingSalary(totalSalary, advanceAmount);
      const remaining3 = calculateRemainingSalary(totalSalary, advanceAmount);
      
      // Property: Multiple calculations should yield identical results
      expect(remaining1).toBe(remaining2);
      expect(remaining2).toBe(remaining3);
      
      // Property: Calculation should be deterministic
      expect(remaining1).toBe(Math.round((totalSalary - advanceAmount) * 100) / 100);
    }), { numRuns: 100 });
  });

  test('should handle edge cases correctly', () => {
    fc.assert(fc.property(validSalaryGen, (totalSalary) => {
      // Test with zero advance
      const remainingZeroAdvance = calculateRemainingSalary(totalSalary, 0);
      expect(remainingZeroAdvance).toBe(totalSalary);
      
      // Test with full advance (if total > 0)
      if (totalSalary > 0) {
        const remainingFullAdvance = calculateRemainingSalary(totalSalary, totalSalary);
        expect(remainingFullAdvance).toBe(0);
      }
      
      // Test with very small amounts
      if (totalSalary >= 0.01) {
        const remainingSmallAdvance = calculateRemainingSalary(totalSalary, 0.01);
        expect(remainingSmallAdvance).toBe(Math.round((totalSalary - 0.01) * 100) / 100);
      }
    }), { numRuns: 100 });
  });

  test('should validate input constraints for any inputs', () => {
    fc.assert(fc.property(
      fc.oneof(
        fc.integer({ min: -100000, max: -1 }).map(n => n / 100), // Negative total salary
        fc.constant('invalid'), // Non-number total salary
        fc.constant(null),
        fc.constant(undefined)
      ),
      fc.integer({ min: 0, max: 100000 }).map(n => n / 100),
      (invalidTotal, validAdvance) => {
        // Property: Invalid total salary should always throw an error
        expect(() => calculateRemainingSalary(invalidTotal, validAdvance)).toThrow();
      }
    ), { numRuns: 50 });

    fc.assert(fc.property(
      validSalaryGen,
      fc.oneof(
        fc.integer({ min: -100000, max: -1 }).map(n => n / 100), // Negative advance
        fc.constant('invalid'), // Non-number advance
        fc.constant(null),
        fc.constant(undefined)
      ),
      (validTotal, invalidAdvance) => {
        // Property: Invalid advance amount should always throw an error
        expect(() => calculateRemainingSalary(validTotal, invalidAdvance)).toThrow();
      }
    ), { numRuns: 50 });
  });

  test('should reject advance amounts exceeding total salary', () => {
    fc.assert(fc.property(validSalaryGen.filter(s => s < 99999), (totalSalary) => {
      const excessiveAdvance = totalSalary + 100; // Add fixed amount to exceed total
      
      // Property: Advance exceeding total should always throw an error
      expect(() => calculateRemainingSalary(totalSalary, excessiveAdvance)).toThrow();
    }), { numRuns: 100 });
  });

  test('should maintain precision for monetary calculations', () => {
    fc.assert(fc.property(validSalaryAdvancePairGen, ({ totalSalary, advanceAmount }) => {
      const remaining = calculateRemainingSalary(totalSalary, advanceAmount);
      
      // Property: Result should have at most 2 decimal places
      const roundedResult = Math.round(remaining * 100) / 100;
      expect(remaining).toBe(roundedResult);
      
      // Property: Precision should be maintained in calculation
      expect(remaining).toBe(Math.round((totalSalary - advanceAmount) * 100) / 100);
    }), { numRuns: 100 });
  });
});

/**
 * Property tests for payment status determination
 * Feature: salary-tracker-system, Property 1: Salary calculation accuracy  
 * Validates: Requirements 2.1, 7.1
 */
describe('Payment Status Determination Properties', () => {
  const validSalaryAdvancePairGen = fc.record({
    totalSalary: fc.integer({ min: 0, max: 10000000 }).map(n => n / 100),
  }).chain(base => 
    fc.record({
      totalSalary: fc.constant(base.totalSalary),
      advanceAmount: fc.integer({ min: 0, max: Math.round(base.totalSalary * 100) }).map(n => n / 100)
    })
  );

  test('should determine payment status correctly for any valid inputs', () => {
    fc.assert(fc.property(validSalaryAdvancePairGen, ({ totalSalary, advanceAmount }) => {
      const status = determinePaymentStatus(totalSalary, advanceAmount);
      const remaining = calculateRemainingSalary(totalSalary, advanceAmount);
      
      // Property: Status should always be one of the valid values
      expect(['Pending', 'Partially Paid', 'Paid']).toContain(status);
      
      // Property: Status should match business rules
      if (remaining === 0) {
        expect(status).toBe('Paid');
      } else if (advanceAmount > 0 && remaining > 0) {
        expect(status).toBe('Partially Paid');
      } else if (advanceAmount === 0) {
        expect(status).toBe('Pending');
      }
      
      // Property: Status should be deterministic
      const status2 = determinePaymentStatus(totalSalary, advanceAmount);
      expect(status).toBe(status2);
    }), { numRuns: 100 });
  });

  test('should handle status transitions correctly', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 10000000 }).map(n => n / 100), (totalSalary) => {
      // Property: Zero advance should always be Pending
      expect(determinePaymentStatus(totalSalary, 0)).toBe('Pending');
      
      // Property: Full advance should always be Paid
      expect(determinePaymentStatus(totalSalary, totalSalary)).toBe('Paid');
      
      // Property: Partial advance should be Partially Paid (if total > 0.01)
      if (totalSalary > 0.02) {
        const partialAdvance = Math.round(totalSalary * 50) / 100; // 50% of total
        if (partialAdvance > 0 && partialAdvance < totalSalary) {
          expect(determinePaymentStatus(totalSalary, partialAdvance)).toBe('Partially Paid');
        }
      }
    }), { numRuns: 100 });
  });
});

/**
 * Property tests for comprehensive salary calculations
 * Feature: salary-tracker-system, Property 1: Salary calculation accuracy
 * Validates: Requirements 2.1, 7.1
 */
describe('Comprehensive Salary Calculation Properties', () => {
  const validSalaryDataGen = fc.record({
    totalMonthlySalary: fc.integer({ min: 0, max: 10000000 }).map(n => n / 100),
  }).chain(base => 
    fc.record({
      totalMonthlySalary: fc.constant(base.totalMonthlySalary),
      advanceAmountPaid: fc.integer({ min: 0, max: Math.round(base.totalMonthlySalary * 100) }).map(n => n / 100)
    })
  );

  test('should provide complete and consistent salary calculations', () => {
    fc.assert(fc.property(validSalaryDataGen, (salaryData) => {
      const result = calculateSalaryDetails(salaryData);
      
      // Property: Result should contain all required fields
      expect(result.totalMonthlySalary).toBeDefined();
      expect(result.advanceAmountPaid).toBeDefined();
      expect(result.remainingSalaryPayable).toBeDefined();
      expect(result.paymentStatus).toBeDefined();
      expect(result.calculatedAt).toBeInstanceOf(Date);
      
      // Property: Input values should be preserved
      expect(result.totalMonthlySalary).toBe(salaryData.totalMonthlySalary);
      expect(result.advanceAmountPaid).toBe(salaryData.advanceAmountPaid);
      
      // Property: Calculated values should be consistent with individual functions
      const expectedRemaining = calculateRemainingSalary(salaryData.totalMonthlySalary, salaryData.advanceAmountPaid);
      const expectedStatus = determinePaymentStatus(salaryData.totalMonthlySalary, salaryData.advanceAmountPaid);
      
      expect(result.remainingSalaryPayable).toBe(expectedRemaining);
      expect(result.paymentStatus).toBe(expectedStatus);
      
      // Property: Calculation timestamp should be recent
      const now = new Date();
      const timeDiff = now.getTime() - result.calculatedAt.getTime();
      expect(timeDiff).toBeLessThan(1000); // Less than 1 second ago
    }), { numRuns: 100 });
  });

  test('should maintain mathematical relationships', () => {
    fc.assert(fc.property(validSalaryDataGen, (salaryData) => {
      const result = calculateSalaryDetails(salaryData);
      
      // Property: Total = Advance + Remaining (accounting for rounding)
      const sum = result.advanceAmountPaid + result.remainingSalaryPayable;
      const expectedSum = result.totalMonthlySalary;
      expect(Math.abs(sum - expectedSum)).toBeLessThan(0.01);
      
      // Property: Remaining should never exceed total
      expect(result.remainingSalaryPayable).toBeLessThanOrEqual(result.totalMonthlySalary);
      
      // Property: Advance should never exceed total
      expect(result.advanceAmountPaid).toBeLessThanOrEqual(result.totalMonthlySalary);
      
      // Property: All monetary values should be non-negative
      expect(result.totalMonthlySalary).toBeGreaterThanOrEqual(0);
      expect(result.advanceAmountPaid).toBeGreaterThanOrEqual(0);
      expect(result.remainingSalaryPayable).toBeGreaterThanOrEqual(0);
    }), { numRuns: 100 });
  });
});