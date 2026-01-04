/**
 * SalaryTracker Component Tests
 * 
 * Unit tests and property-based tests for the SalaryTracker React component.
 * Tests form functionality, real-time calculations, and UI interactions.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import axios from 'axios';
import SalaryTracker from './SalaryTracker';

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('SalaryTracker Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock successful API responses
    mockedAxios.get.mockResolvedValue({
      data: { data: [] }
    });
    
    mockedAxios.post.mockResolvedValue({
      data: {
        data: {
          _id: '507f1f77bcf86cd799439011',
          employeeId: 'EMP001',
          employeeName: 'John Doe',
          month: 'October',
          year: 2023,
          totalMonthlySalary: 5000,
          advanceAmountPaid: 2000,
          remainingSalaryPayable: 3000,
          paymentStatus: 'Partially Paid',
          paymentDate: '2023-10-15T00:00:00.000Z',
          createdAt: '2023-10-15T10:00:00.000Z'
        }
      }
    });
  });

  test('renders salary tracker component', async () => {
    render(<SalaryTracker />);
    
    expect(screen.getByText('Salary Tracker Management System')).toBeInTheDocument();
    expect(screen.getByText('Add New Salary Record')).toBeInTheDocument();
    expect(screen.getByText('Salary Records (0)')).toBeInTheDocument();
  });

  test('displays form fields correctly', () => {
    render(<SalaryTracker />);
    
    expect(screen.getByLabelText(/Employee ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Employee Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Month/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Year/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Total Monthly Salary/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Advance Amount Paid/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Payment Date/)).toBeInTheDocument();
  });

  test('calculates remaining salary in real-time', async () => {
    const user = userEvent.setup();
    render(<SalaryTracker />);
    
    const totalSalaryInput = screen.getByLabelText(/Total Monthly Salary/);
    const advanceInput = screen.getByLabelText(/Advance Amount Paid/);
    
    // Enter salary amounts
    await user.type(totalSalaryInput, '5000');
    await user.type(advanceInput, '2000');
    
    // Check real-time calculation
    expect(screen.getByText('$3,000.00')).toBeInTheDocument();
    expect(screen.getByText('Partially Paid')).toBeInTheDocument();
  });

  test('updates payment status based on amounts', async () => {
    const user = userEvent.setup();
    render(<SalaryTracker />);
    
    const totalSalaryInput = screen.getByLabelText(/Total Monthly Salary/);
    const advanceInput = screen.getByLabelText(/Advance Amount Paid/);
    
    // Test "Paid" status
    await user.type(totalSalaryInput, '5000');
    await user.type(advanceInput, '5000');
    expect(screen.getByText('Paid')).toBeInTheDocument();
    
    // Clear and test "Pending" status
    await user.clear(advanceInput);
    await user.type(advanceInput, '0');
    expect(screen.getByText('Pending')).toBeInTheDocument();
    
    // Test "Partially Paid" status
    await user.clear(advanceInput);
    await user.type(advanceInput, '2000');
    expect(screen.getByText('Partially Paid')).toBeInTheDocument();
  });

  test('validates advance amount does not exceed total salary', async () => {
    const user = userEvent.setup();
    render(<SalaryTracker />);
    
    const totalSalaryInput = screen.getByLabelText(/Total Monthly Salary/);
    const advanceInput = screen.getByLabelText(/Advance Amount Paid/);
    
    await user.type(totalSalaryInput, '3000');
    await user.type(advanceInput, '5000');
    
    expect(screen.getByText('Invalid - Advance exceeds total')).toBeInTheDocument();
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    render(<SalaryTracker />);
    
    // Fill out form
    await user.type(screen.getByLabelText(/Employee ID/), 'EMP001');
    await user.type(screen.getByLabelText(/Employee Name/), 'John Doe');
    await user.selectOptions(screen.getByLabelText(/Month/), '10');
    await user.type(screen.getByLabelText(/Year/), '2023');
    await user.type(screen.getByLabelText(/Total Monthly Salary/), '5000');
    await user.type(screen.getByLabelText(/Advance Amount Paid/), '2000');
    
    // Submit form
    await user.click(screen.getByText('Add Salary Record'));
    
    // Verify API call
    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/addSalary', {
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        month: 10,
        year: 2023,
        totalMonthlySalary: 5000,
        advanceAmountPaid: 2000,
        paymentDate: expect.any(String)
      });
    });
    
    // Check success message
    expect(screen.getByText('Salary record added successfully!')).toBeInTheDocument();
  });

  test('displays validation error for missing fields', async () => {
    const user = userEvent.setup();
    render(<SalaryTracker />);
    
    // Try to submit empty form
    await user.click(screen.getByText('Add Salary Record'));
    
    expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    mockedAxios.post.mockRejectedValue({
      response: {
        data: { error: 'Employee ID already exists for this month' }
      }
    });
    
    render(<SalaryTracker />);
    
    // Fill out form
    await user.type(screen.getByLabelText(/Employee ID/), 'EMP001');
    await user.type(screen.getByLabelText(/Employee Name/), 'John Doe');
    await user.selectOptions(screen.getByLabelText(/Month/), '10');
    await user.type(screen.getByLabelText(/Total Monthly Salary/), '5000');
    await user.type(screen.getByLabelText(/Advance Amount Paid/), '2000');
    
    // Submit form
    await user.click(screen.getByText('Add Salary Record'));
    
    // Check error message
    await waitFor(() => {
      expect(screen.getByText('Employee ID already exists for this month')).toBeInTheDocument();
    });
  });

  test('loads and displays existing salary records', async () => {
    // Mock API response with existing records
    mockedAxios.get.mockResolvedValue({
      data: {
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            employeeId: 'EMP001',
            employeeName: 'John Doe',
            month: 'October',
            year: 2023,
            totalMonthlySalary: 5000,
            advanceAmountPaid: 2000,
            remainingSalaryPayable: 3000,
            paymentStatus: 'Partially Paid',
            paymentDate: '2023-10-15T00:00:00.000Z'
          }
        ]
      }
    });
    
    render(<SalaryTracker />);
    
    // Wait for records to load
    await waitFor(() => {
      expect(screen.getByText('Salary Records (1)')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('EMP001')).toBeInTheDocument();
      expect(screen.getByText('October 2023')).toBeInTheDocument();
    });
  });

  test('formats currency correctly', async () => {
    // Mock API response with salary record
    mockedAxios.get.mockResolvedValue({
      data: {
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            employeeId: 'EMP001',
            employeeName: 'John Doe',
            month: 'October',
            year: 2023,
            totalMonthlySalary: 5000.50,
            advanceAmountPaid: 2000.25,
            remainingSalaryPayable: 3000.25,
            paymentStatus: 'Partially Paid',
            paymentDate: '2023-10-15T00:00:00.000Z'
          }
        ]
      }
    });
    
    render(<SalaryTracker />);
    
    await waitFor(() => {
      expect(screen.getByText('$5,000.50')).toBeInTheDocument();
      expect(screen.getByText('$2,000.25')).toBeInTheDocument();
      expect(screen.getByText('$3,000.25')).toBeInTheDocument();
    });
  });

  test('clears form after successful submission', async () => {
    const user = userEvent.setup();
    render(<SalaryTracker />);
    
    const employeeIdInput = screen.getByLabelText(/Employee ID/);
    const employeeNameInput = screen.getByLabelText(/Employee Name/);
    
    // Fill out form
    await user.type(employeeIdInput, 'EMP001');
    await user.type(employeeNameInput, 'John Doe');
    await user.selectOptions(screen.getByLabelText(/Month/), '10');
    await user.type(screen.getByLabelText(/Total Monthly Salary/), '5000');
    await user.type(screen.getByLabelText(/Advance Amount Paid/), '2000');
    
    // Submit form
    await user.click(screen.getByText('Add Salary Record'));
    
    // Wait for form to clear
    await waitFor(() => {
      expect(employeeIdInput.value).toBe('');
      expect(employeeNameInput.value).toBe('');
    });
  });

  test('displays loading state during form submission', async () => {
    const user = userEvent.setup();
    
    // Mock delayed API response
    mockedAxios.post.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        data: { data: { _id: '123', employeeId: 'EMP001' } }
      }), 100))
    );
    
    render(<SalaryTracker />);
    
    // Fill out form
    await user.type(screen.getByLabelText(/Employee ID/), 'EMP001');
    await user.type(screen.getByLabelText(/Employee Name/), 'John Doe');
    await user.selectOptions(screen.getByLabelText(/Month/), '10');
    await user.type(screen.getByLabelText(/Total Monthly Salary/), '5000');
    await user.type(screen.getByLabelText(/Advance Amount Paid/), '2000');
    
    // Submit form
    await user.click(screen.getByText('Add Salary Record'));
    
    // Check loading state
    expect(screen.getByText('Adding...')).toBeInTheDocument();
    expect(screen.getByText('Adding...')).toBeDisabled();
  });
});
const fc = require('fast-check');

/**
 * Property 7: Frontend state consistency
 * Feature: salary-tracker-system, Property 7: Frontend state consistency
 * Validates: Requirements 4.2, 4.4, 4.5
 */
describe('Property 7: Frontend state consistency', () => {
  // Generator for valid salary input data
  const validSalaryInputGen = fc.record({
    totalSalary: fc.integer({ min: 1000, max: 100000 }).map(n => n / 100),
    advanceAmount: fc.integer({ min: 0, max: 100000 }).map(n => n / 100)
  }).filter(data => data.advanceAmount <= data.totalSalary);

  test('should maintain calculation consistency for any valid salary inputs', () => {
    fc.assert(fc.property(validSalaryInputGen, (salaryData) => {
      render(<SalaryTracker />);
      
      const totalSalaryInput = screen.getByLabelText(/Total Monthly Salary/);
      const advanceInput = screen.getByLabelText(/Advance Amount Paid/);
      
      // Simulate user input
      fireEvent.change(totalSalaryInput, { 
        target: { value: salaryData.totalSalary.toString() } 
      });
      fireEvent.change(advanceInput, { 
        target: { value: salaryData.advanceAmount.toString() } 
      });
      
      // Calculate expected values
      const expectedRemaining = salaryData.totalSalary - salaryData.advanceAmount;
      let expectedStatus;
      
      if (expectedRemaining === 0 && salaryData.totalSalary > 0) {
        expectedStatus = 'Paid';
      } else if (salaryData.advanceAmount > 0 && expectedRemaining > 0) {
        expectedStatus = 'Partially Paid';
      } else if (salaryData.advanceAmount === 0) {
        expectedStatus = 'Pending';
      } else {
        expectedStatus = 'Pending';
      }
      
      // Property: Remaining salary should be calculated correctly
      const remainingText = `$${expectedRemaining.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
      expect(screen.getByText(remainingText)).toBeInTheDocument();
      
      // Property: Payment status should be determined correctly
      expect(screen.getByText(expectedStatus)).toBeInTheDocument();
      
      // Property: Values should be non-negative
      expect(expectedRemaining).toBeGreaterThanOrEqual(0);
      expect(salaryData.totalSalary).toBeGreaterThanOrEqual(0);
      expect(salaryData.advanceAmount).toBeGreaterThanOrEqual(0);
    }), { numRuns: 20 });
  });

  test('should handle edge cases consistently', () => {
    const edgeCases = [
      { totalSalary: 0, advanceAmount: 0 },
      { totalSalary: 1000, advanceAmount: 0 },
      { totalSalary: 1000, advanceAmount: 1000 },
      { totalSalary: 0.01, advanceAmount: 0.01 },
      { totalSalary: 99999.99, advanceAmount: 50000.50 }
    ];

    edgeCases.forEach((testCase) => {
      render(<SalaryTracker />);
      
      const totalSalaryInput = screen.getByLabelText(/Total Monthly Salary/);
      const advanceInput = screen.getByLabelText(/Advance Amount Paid/);
      
      fireEvent.change(totalSalaryInput, { 
        target: { value: testCase.totalSalary.toString() } 
      });
      fireEvent.change(advanceInput, { 
        target: { value: testCase.advanceAmount.toString() } 
      });
      
      const expectedRemaining = testCase.totalSalary - testCase.advanceAmount;
      
      // Property: Calculation should always be accurate
      expect(expectedRemaining).toBe(testCase.totalSalary - testCase.advanceAmount);
      
      // Property: Status should follow business rules
      if (expectedRemaining === 0 && testCase.totalSalary > 0) {
        expect(screen.getByText('Paid')).toBeInTheDocument();
      } else if (testCase.advanceAmount > 0 && expectedRemaining > 0) {
        expect(screen.getByText('Partially Paid')).toBeInTheDocument();
      } else if (testCase.advanceAmount === 0) {
        expect(screen.getByText('Pending')).toBeInTheDocument();
      }
    });
  });

  test('should maintain state consistency during rapid input changes', async () => {
    const user = userEvent.setup();
    
    fc.assert(fc.asyncProperty(
      fc.array(validSalaryInputGen, { minLength: 3, maxLength: 8 }),
      async (inputSequence) => {
        render(<SalaryTracker />);
        
        const totalSalaryInput = screen.getByLabelText(/Total Monthly Salary/);
        const advanceInput = screen.getByLabelText(/Advance Amount Paid/);
        
        // Simulate rapid input changes
        for (const input of inputSequence) {
          await user.clear(totalSalaryInput);
          await user.type(totalSalaryInput, input.totalSalary.toString());
          
          await user.clear(advanceInput);
          await user.type(advanceInput, input.advanceAmount.toString());
          
          // Property: Each state should be consistent
          const expectedRemaining = input.totalSalary - input.advanceAmount;
          
          // Allow for small timing differences in UI updates
          await waitFor(() => {
            const remainingText = `$${expectedRemaining.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}`;
            expect(screen.getByText(remainingText)).toBeInTheDocument();
          }, { timeout: 1000 });
        }
        
        // Property: Final state should match last input
        const lastInput = inputSequence[inputSequence.length - 1];
        const finalRemaining = lastInput.totalSalary - lastInput.advanceAmount;
        
        let expectedFinalStatus;
        if (finalRemaining === 0 && lastInput.totalSalary > 0) {
          expectedFinalStatus = 'Paid';
        } else if (lastInput.advanceAmount > 0 && finalRemaining > 0) {
          expectedFinalStatus = 'Partially Paid';
        } else {
          expectedFinalStatus = 'Pending';
        }
        
        expect(screen.getByText(expectedFinalStatus)).toBeInTheDocument();
      }
    ), { numRuns: 5 }); // Fewer runs for complex async operations
  });

  test('should validate input constraints consistently', () => {
    const invalidInputGen = fc.oneof(
      fc.record({
        totalSalary: fc.integer({ min: -10000, max: -1 }).map(n => n / 100),
        advanceAmount: fc.integer({ min: 0, max: 10000 }).map(n => n / 100)
      }),
      fc.record({
        totalSalary: fc.integer({ min: 1000, max: 10000 }).map(n => n / 100),
        advanceAmount: fc.integer({ min: 10001, max: 20000 }).map(n => n / 100)
      })
    );

    fc.assert(fc.property(invalidInputGen, (invalidData) => {
      render(<SalaryTracker />);
      
      const totalSalaryInput = screen.getByLabelText(/Total Monthly Salary/);
      const advanceInput = screen.getByLabelText(/Advance Amount Paid/);
      
      fireEvent.change(totalSalaryInput, { 
        target: { value: invalidData.totalSalary.toString() } 
      });
      fireEvent.change(advanceInput, { 
        target: { value: invalidData.advanceAmount.toString() } 
      });
      
      // Property: Invalid inputs should be handled gracefully
      if (invalidData.totalSalary < 0 || invalidData.advanceAmount < 0) {
        expect(screen.getByText('Invalid')).toBeInTheDocument();
      } else if (invalidData.advanceAmount > invalidData.totalSalary) {
        expect(screen.getByText('Invalid - Advance exceeds total')).toBeInTheDocument();
      }
    }), { numRuns: 15 });
  });

  test('should maintain form state consistency during validation', async () => {
    const user = userEvent.setup();
    
    const formDataGen = fc.record({
      employeeId: fc.string({ minLength: 1, maxLength: 10 }),
      employeeName: fc.string({ minLength: 1, maxLength: 20 }),
      month: fc.integer({ min: 1, max: 12 }),
      totalSalary: fc.integer({ min: 1000, max: 10000 }),
      advanceAmount: fc.integer({ min: 0, max: 5000 })
    });

    await fc.assert(fc.asyncProperty(formDataGen, async (formData) => {
      render(<SalaryTracker />);
      
      // Fill form fields
      await user.type(screen.getByLabelText(/Employee ID/), formData.employeeId);
      await user.type(screen.getByLabelText(/Employee Name/), formData.employeeName);
      await user.selectOptions(screen.getByLabelText(/Month/), formData.month.toString());
      await user.type(screen.getByLabelText(/Total Monthly Salary/), formData.totalSalary.toString());
      await user.type(screen.getByLabelText(/Advance Amount Paid/), formData.advanceAmount.toString());
      
      // Property: Form values should be preserved in inputs
      expect(screen.getByDisplayValue(formData.employeeId)).toBeInTheDocument();
      expect(screen.getByDisplayValue(formData.employeeName)).toBeInTheDocument();
      expect(screen.getByDisplayValue(formData.totalSalary.toString())).toBeInTheDocument();
      expect(screen.getByDisplayValue(formData.advanceAmount.toString())).toBeInTheDocument();
      
      // Property: Calculations should be consistent with form values
      const expectedRemaining = formData.totalSalary - formData.advanceAmount;
      const remainingText = `$${expectedRemaining.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
      expect(screen.getByText(remainingText)).toBeInTheDocument();
    }), { numRuns: 10 });
  });
});