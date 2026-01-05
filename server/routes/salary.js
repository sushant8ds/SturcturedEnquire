/**
 * Salary Management Routes
 * 
 * Express route handlers for salary record management operations.
 * Integrates with salary calculation utilities and MongoDB persistence.
 */

const express = require('express');
const router = express.Router();
const SalaryRecord = require('../models/SalaryRecord');
const { calculateSalaryDetails, validateAdvanceAmount } = require('../utils/salaryCalculations');

/**
 * POST /addSalary
 * 
 * Creates a new salary record with automatic calculations
 * 
 * Request Body:
 * - employeeId: string (required)
 * - employeeName: string (required) 
 * - month: number (1-12, required)
 * - year: number (required)
 * - totalMonthlySalary: number (required)
 * - advanceAmountPaid: number (required, >= 0)
 * - paymentDate: string (ISO date, required)
 * 
 * Response:
 * - 201: Created salary record with computed fields
 * - 400: Validation error
 * - 500: Server error
 */
router.post('/addSalary', async (req, res) => {
  try {
    // Extract and validate required fields
    const {
      employeeId,
      employeeName,
      month,
      year,
      totalMonthlySalary,
      advanceAmountPaid,
      paymentDate
    } = req.body;

    // Basic field validation
    if (!employeeId || typeof employeeId !== 'string') {
      return res.status(400).json({
        error: 'Employee ID is required and must be a string',
        field: 'employeeId'
      });
    }

    if (!employeeName || typeof employeeName !== 'string') {
      return res.status(400).json({
        error: 'Employee name is required and must be a string',
        field: 'employeeName'
      });
    }

    if (!month || typeof month !== 'number' || month < 1 || month > 12) {
      return res.status(400).json({
        error: 'Month is required and must be a number between 1 and 12',
        field: 'month'
      });
    }

    // Convert numeric month to month name for schema compatibility
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1];

    if (!year || typeof year !== 'number' || year < 1900 || year > 2100) {
      return res.status(400).json({
        error: 'Year is required and must be a valid year',
        field: 'year'
      });
    }

    if (typeof totalMonthlySalary !== 'number') {
      return res.status(400).json({
        error: 'Total monthly salary is required and must be a number',
        field: 'totalMonthlySalary'
      });
    }

    if (typeof advanceAmountPaid !== 'number') {
      return res.status(400).json({
        error: 'Advance amount paid is required and must be a number',
        field: 'advanceAmountPaid'
      });
    }

    if (!paymentDate) {
      return res.status(400).json({
        error: 'Payment date is required',
        field: 'paymentDate'
      });
    }

    // Validate payment date format
    const parsedPaymentDate = new Date(paymentDate);
    if (isNaN(parsedPaymentDate.getTime())) {
      return res.status(400).json({
        error: 'Payment date must be a valid ISO date string',
        field: 'paymentDate'
      });
    }

    // Perform salary calculations with validation
    let salaryDetails;
    try {
      salaryDetails = calculateSalaryDetails({
        totalMonthlySalary,
        advanceAmountPaid
      });
    } catch (calculationError) {
      return res.status(400).json({
        error: calculationError.message,
        field: 'salary_calculation'
      });
    }

    // Create salary record data
    const salaryRecordData = {
      employeeId,
      employeeName,
      month: monthName, // Use converted month name
      year,
      totalMonthlySalary: salaryDetails.totalMonthlySalary,
      advanceAmountPaid: salaryDetails.advanceAmountPaid,
      remainingSalaryPayable: salaryDetails.remainingSalaryPayable,
      paymentDate: parsedPaymentDate,
      paymentStatus: salaryDetails.paymentStatus
    };

    // Create and save the salary record
    const salaryRecord = new SalaryRecord(salaryRecordData);
    const savedRecord = await salaryRecord.save();

    // Return success response with computed fields
    res.status(201).json({
      message: 'Salary record created successfully',
      data: {
        id: savedRecord._id,
        employeeId: savedRecord.employeeId,
        employeeName: savedRecord.employeeName,
        month: savedRecord.month,
        year: savedRecord.year,
        totalMonthlySalary: savedRecord.totalMonthlySalary,
        advanceAmountPaid: savedRecord.advanceAmountPaid,
        remainingSalaryPayable: savedRecord.remainingSalaryPayable,
        paymentDate: savedRecord.paymentDate,
        paymentStatus: savedRecord.paymentStatus,
        createdAt: savedRecord.createdAt,
        updatedAt: savedRecord.updatedAt
      },
      calculations: {
        remainingSalary: salaryDetails.remainingSalaryPayable,
        paymentStatus: salaryDetails.paymentStatus,
        calculatedAt: salaryDetails.calculatedAt
      }
    });

  } catch (error) {
    console.error('Error creating salary record:', error);
    
    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors).map(field => ({
        field,
        message: error.errors[field].message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'A salary record for this employee and month/year already exists',
        field: 'duplicate_record'
      });
    }

    // Generic server error
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating the salary record'
    });
  }
});

/**
 * GET /salaries
 * 
 * Retrieves salary records with optional filtering
 * 
 * Query Parameters:
 * - employeeId: string (optional) - Filter by employee ID
 * - month: string (optional) - Filter by month name
 * - year: number (optional) - Filter by year
 * - paymentStatus: string (optional) - Filter by payment status
 * - limit: number (optional, default: 50) - Limit number of results
 * - skip: number (optional, default: 0) - Skip number of results for pagination
 * 
 * Response:
 * - 200: Array of salary records matching criteria
 * - 400: Invalid query parameters
 * - 500: Server error
 */
router.get('/salaries', async (req, res) => {
  try {
    const {
      employeeId,
      month,
      year,
      paymentStatus,
      limit = 50,
      skip = 0
    } = req.query;

    // Build query filter
    const filter = {};

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    if (month) {
      const validMonths = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      if (!validMonths.includes(month)) {
        return res.status(400).json({
          error: 'Invalid month. Must be a valid month name (e.g., January, February, etc.)',
          field: 'month'
        });
      }
      filter.month = month;
    }

    if (year) {
      const yearNum = parseInt(year);
      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return res.status(400).json({
          error: 'Invalid year. Must be a number between 2000 and 2100',
          field: 'year'
        });
      }
      filter.year = yearNum;
    }

    if (paymentStatus) {
      const validStatuses = ['Pending', 'Partially Paid', 'Paid'];
      if (!validStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          error: 'Invalid payment status. Must be one of: Pending, Partially Paid, Paid',
          field: 'paymentStatus'
        });
      }
      filter.paymentStatus = paymentStatus;
    }

    // Validate pagination parameters
    const limitNum = parseInt(limit);
    const skipNum = parseInt(skip);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: 'Invalid limit. Must be a number between 1 and 100',
        field: 'limit'
      });
    }

    if (isNaN(skipNum) || skipNum < 0) {
      return res.status(400).json({
        error: 'Invalid skip. Must be a non-negative number',
        field: 'skip'
      });
    }

    // Execute query
    const salaryRecords = await SalaryRecord
      .find(filter)
      .sort({ createdAt: -1 }) // Most recent first
      .limit(limitNum)
      .skip(skipNum)
      .lean(); // Return plain objects for better performance

    // Get total count for pagination info
    const totalCount = await SalaryRecord.countDocuments(filter);

    res.json({
      data: salaryRecords,
      pagination: {
        total: totalCount,
        limit: limitNum,
        skip: skipNum,
        hasMore: skipNum + limitNum < totalCount
      },
      filter: filter
    });

  } catch (error) {
    console.error('Error retrieving salary records:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while retrieving salary records'
    });
  }
});

/**
 * GET /salaries/:id
 * 
 * Retrieves a specific salary record by ID
 * 
 * Parameters:
 * - id: MongoDB ObjectId of the salary record
 * 
 * Response:
 * - 200: Salary record data
 * - 400: Invalid ID format
 * - 404: Record not found
 * - 500: Server error
 */
router.get('/salaries/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid ID format. Must be a valid MongoDB ObjectId',
        field: 'id'
      });
    }

    const salaryRecord = await SalaryRecord.findById(id);

    if (!salaryRecord) {
      return res.status(404).json({
        error: 'Salary record not found',
        id: id
      });
    }

    res.json({
      data: salaryRecord
    });

  } catch (error) {
    console.error('Error retrieving salary record:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while retrieving the salary record'
    });
  }
});

/**
 * DELETE /salaries/:id
 * 
 * Deletes a specific salary record by ID
 * 
 * Parameters:
 * - id: MongoDB ObjectId of the salary record to delete
 * 
 * Response:
 * - 200: Successfully deleted record
 * - 400: Invalid ID format
 * - 404: Record not found
 * - 500: Server error
 */
router.delete('/salaries/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid ID format. Must be a valid MongoDB ObjectId',
        field: 'id'
      });
    }

    // Find the record first to get details for response
    const salaryRecord = await SalaryRecord.findById(id);

    if (!salaryRecord) {
      return res.status(404).json({
        error: 'Salary record not found',
        id: id
      });
    }

    // Delete the record
    await SalaryRecord.findByIdAndDelete(id);

    res.json({
      message: 'Salary record deleted successfully',
      deletedRecord: {
        id: salaryRecord._id,
        employeeId: salaryRecord.employeeId,
        employeeName: salaryRecord.employeeName,
        month: salaryRecord.month,
        year: salaryRecord.year,
        totalMonthlySalary: salaryRecord.totalMonthlySalary,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error deleting salary record:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while deleting the salary record'
    });
  }
});

/**
 * GET /employees/:employeeId/salaries
 * 
 * Retrieves all salary records for a specific employee
 * 
 * Parameters:
 * - employeeId: Employee ID to filter by
 * 
 * Query Parameters:
 * - year: number (optional) - Filter by specific year
 * - paymentStatus: string (optional) - Filter by payment status
 * 
 * Response:
 * - 200: Array of salary records for the employee
 * - 400: Invalid parameters
 * - 500: Server error
 */
router.get('/employees/:employeeId/salaries', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { year, paymentStatus } = req.query;

    if (!employeeId || typeof employeeId !== 'string') {
      return res.status(400).json({
        error: 'Employee ID is required',
        field: 'employeeId'
      });
    }

    // Build query filter
    const filter = { employeeId };

    if (year) {
      const yearNum = parseInt(year);
      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return res.status(400).json({
          error: 'Invalid year. Must be a number between 2000 and 2100',
          field: 'year'
        });
      }
      filter.year = yearNum;
    }

    if (paymentStatus) {
      const validStatuses = ['Pending', 'Partially Paid', 'Paid'];
      if (!validStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          error: 'Invalid payment status. Must be one of: Pending, Partially Paid, Paid',
          field: 'paymentStatus'
        });
      }
      filter.paymentStatus = paymentStatus;
    }

    // Execute query
    const salaryRecords = await SalaryRecord
      .find(filter)
      .sort({ year: -1, month: 1 }) // Most recent year first, then by month
      .lean();

    // Calculate summary statistics
    const totalRecords = salaryRecords.length;
    const totalSalary = salaryRecords.reduce((sum, record) => sum + record.totalMonthlySalary, 0);
    const totalAdvances = salaryRecords.reduce((sum, record) => sum + record.advanceAmountPaid, 0);
    const totalRemaining = salaryRecords.reduce((sum, record) => sum + record.remainingSalaryPayable, 0);

    const statusCounts = salaryRecords.reduce((counts, record) => {
      counts[record.paymentStatus] = (counts[record.paymentStatus] || 0) + 1;
      return counts;
    }, {});

    res.json({
      employeeId,
      data: salaryRecords,
      summary: {
        totalRecords,
        totalSalary: Math.round(totalSalary * 100) / 100,
        totalAdvances: Math.round(totalAdvances * 100) / 100,
        totalRemaining: Math.round(totalRemaining * 100) / 100,
        statusCounts
      }
    });

  } catch (error) {
    console.error('Error retrieving employee salary records:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while retrieving employee salary records'
    });
  }
});

module.exports = router;