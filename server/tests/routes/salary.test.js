/**
 * Salary Routes API Tests
 * 
 * Tests for the Express route handlers for salary management.
 * Includes unit tests and integration tests for API endpoints.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../index');
const SalaryRecord = require('../../models/SalaryRecord');

// Test database setup
const MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/salary-tracker-test';

describe('Salary Routes', () => {
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await SalaryRecord.deleteMany({});
  });

  afterAll(async () => {
    // Clean up and close database connection
    await SalaryRecord.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/addSalary', () => {
    const validSalaryData = {
      employeeId: 'EMP001',
      employeeName: 'John Doe',
      month: 10,
      year: 2023,
      totalMonthlySalary: 5000,
      advanceAmountPaid: 2000,
      paymentDate: '2023-10-15T00:00:00.000Z'
    };

    test('should create salary record with valid data', async () => {
      const response = await request(app)
        .post('/api/addSalary')
        .send(validSalaryData)
        .expect(201);

      expect(response.body.message).toBe('Salary record created successfully');
      expect(response.body.data).toMatchObject({
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        month: 'October', // Month is stored as name in database
        year: 2023,
        totalMonthlySalary: 5000,
        advanceAmountPaid: 2000,
        remainingSalaryPayable: 3000,
        paymentStatus: 'Partially Paid'
      });

      expect(response.body.calculations).toMatchObject({
        remainingSalary: 3000,
        paymentStatus: 'Partially Paid'
      });

      // Verify record was saved to database
      const savedRecord = await SalaryRecord.findOne({ employeeId: 'EMP001' });
      expect(savedRecord).toBeTruthy();
      expect(savedRecord.remainingSalaryPayable).toBe(3000);
    });

    test('should calculate payment status correctly for different scenarios', async () => {
      // Test "Paid" status
      const paidData = { ...validSalaryData, advanceAmountPaid: 5000 };
      const paidResponse = await request(app)
        .post('/api/addSalary')
        .send(paidData)
        .expect(201);

      expect(paidResponse.body.data.paymentStatus).toBe('Paid');
      expect(paidResponse.body.data.remainingSalaryPayable).toBe(0);

      // Test "Pending" status
      const pendingData = { 
        ...validSalaryData, 
        employeeId: 'EMP002',
        advanceAmountPaid: 0 
      };
      const pendingResponse = await request(app)
        .post('/api/addSalary')
        .send(pendingData)
        .expect(201);

      expect(pendingResponse.body.data.paymentStatus).toBe('Pending');
      expect(pendingResponse.body.data.remainingSalaryPayable).toBe(5000);
    });

    test('should return 400 for missing required fields', async () => {
      const incompleteData = { ...validSalaryData };
      delete incompleteData.employeeId;

      const response = await request(app)
        .post('/api/addSalary')
        .send(incompleteData)
        .expect(400);

      expect(response.body.error).toContain('Employee ID is required');
      expect(response.body.field).toBe('employeeId');
    });

    test('should return 400 for invalid field types', async () => {
      const invalidData = { 
        ...validSalaryData, 
        totalMonthlySalary: 'invalid' 
      };

      const response = await request(app)
        .post('/api/addSalary')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toContain('must be a number');
      expect(response.body.field).toBe('totalMonthlySalary');
    });

    test('should return 400 for invalid month', async () => {
      const invalidData = { ...validSalaryData, month: 13 };

      const response = await request(app)
        .post('/api/addSalary')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toContain('between 1 and 12');
      expect(response.body.field).toBe('month');
    });

    test('should return 400 for invalid year', async () => {
      const invalidData = { ...validSalaryData, year: 1800 };

      const response = await request(app)
        .post('/api/addSalary')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toContain('valid year');
      expect(response.body.field).toBe('year');
    });

    test('should return 400 for invalid payment date', async () => {
      const invalidData = { ...validSalaryData, paymentDate: 'invalid-date' };

      const response = await request(app)
        .post('/api/addSalary')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toContain('valid ISO date');
      expect(response.body.field).toBe('paymentDate');
    });

    test('should return 400 for advance amount exceeding total salary', async () => {
      const invalidData = { 
        ...validSalaryData, 
        advanceAmountPaid: 6000 // Exceeds total salary of 5000
      };

      const response = await request(app)
        .post('/api/addSalary')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toContain('cannot exceed total monthly salary');
      expect(response.body.field).toBe('salary_calculation');
    });

    test('should return 400 for negative amounts', async () => {
      const invalidData = { 
        ...validSalaryData, 
        totalMonthlySalary: -1000 
      };

      const response = await request(app)
        .post('/api/addSalary')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toContain('cannot be negative');
    });

    test('should handle decimal precision correctly', async () => {
      const decimalData = {
        ...validSalaryData,
        totalMonthlySalary: 5000.99,
        advanceAmountPaid: 2000.49
      };

      const response = await request(app)
        .post('/api/addSalary')
        .send(decimalData)
        .expect(201);

      expect(response.body.data.remainingSalaryPayable).toBe(3000.50);
    });

    test('should include timestamps in response', async () => {
      const response = await request(app)
        .post('/api/addSalary')
        .send(validSalaryData)
        .expect(201);

      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();
      expect(response.body.calculations.calculatedAt).toBeDefined();

      // Verify timestamps are valid dates
      expect(new Date(response.body.data.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.body.calculations.calculatedAt)).toBeInstanceOf(Date);
    });
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('Salary Tracker API');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);

      expect(response.body.error).toBe('Endpoint not found');
      expect(response.body.path).toBe('/api/unknown-endpoint');
      expect(response.body.method).toBe('GET');
    });
  });
});

const fc = require('fast-check');

/**
 * Property 8: API response completeness
 * Feature: salary-tracker-system, Property 8: API response completeness
 * Validates: Requirements 5.4
 */
describe('Property 8: API response completeness', () => {
  // Generator for valid salary data
  const validSalaryDataGen = fc.record({
    employeeId: fc.string({ minLength: 1, maxLength: 20 }).map(s => 'EMP' + s),
    employeeName: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z\s]/g, 'A')),
    month: fc.integer({ min: 1, max: 12 }),
    year: fc.integer({ min: 2020, max: 2030 }),
    totalMonthlySalary: fc.integer({ min: 1000, max: 100000 }).map(n => n / 100),
    paymentDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
  }).chain(base => 
    fc.record({
      employeeId: fc.constant(base.employeeId),
      employeeName: fc.constant(base.employeeName),
      month: fc.constant(base.month),
      year: fc.constant(base.year),
      totalMonthlySalary: fc.constant(base.totalMonthlySalary),
      paymentDate: fc.constant(base.paymentDate),
      advanceAmountPaid: fc.integer({ min: 0, max: Math.round(base.totalMonthlySalary * 100) }).map(n => n / 100)
    })
  );

  test('should return complete API response structure for any valid input', async () => {
    await fc.assert(fc.asyncProperty(validSalaryDataGen, async (salaryData) => {
      // Clean up before test
      await SalaryRecord.deleteMany({ employeeId: salaryData.employeeId });

      const response = await request(app)
        .post('/api/addSalary')
        .send(salaryData);

      // Property: Should always return 201 for valid data
      expect(response.status).toBe(201);

      // Property: Response should have required top-level structure
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('calculations');

      // Property: Message should be consistent
      expect(response.body.message).toBe('Salary record created successfully');

      // Property: Data section should contain all required fields
      const data = response.body.data;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('employeeId');
      expect(data).toHaveProperty('employeeName');
      expect(data).toHaveProperty('month');
      expect(data).toHaveProperty('year');
      expect(data).toHaveProperty('totalMonthlySalary');
      expect(data).toHaveProperty('advanceAmountPaid');
      expect(data).toHaveProperty('remainingSalaryPayable');
      expect(data).toHaveProperty('paymentDate');
      expect(data).toHaveProperty('paymentStatus');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');

      // Property: Calculations section should contain computed fields
      const calculations = response.body.calculations;
      expect(calculations).toHaveProperty('remainingSalary');
      expect(calculations).toHaveProperty('paymentStatus');
      expect(calculations).toHaveProperty('calculatedAt');

      // Property: Input data should be preserved correctly
      expect(data.employeeId).toBe(salaryData.employeeId);
      expect(data.employeeName).toBe(salaryData.employeeName);
      expect(data.year).toBe(salaryData.year);
      expect(data.totalMonthlySalary).toBe(salaryData.totalMonthlySalary);
      expect(data.advanceAmountPaid).toBe(salaryData.advanceAmountPaid);

      // Property: Calculated fields should be consistent
      expect(data.remainingSalaryPayable).toBe(calculations.remainingSalary);
      expect(data.paymentStatus).toBe(calculations.paymentStatus);

      // Property: All timestamps should be valid dates
      expect(new Date(data.createdAt)).toBeInstanceOf(Date);
      expect(new Date(data.updatedAt)).toBeInstanceOf(Date);
      expect(new Date(calculations.calculatedAt)).toBeInstanceOf(Date);

      // Property: ID should be a valid MongoDB ObjectId format
      expect(data.id).toMatch(/^[0-9a-fA-F]{24}$/);

      // Property: Payment status should be one of valid values
      expect(['Pending', 'Partially Paid', 'Paid']).toContain(data.paymentStatus);

      // Property: Month should be converted to month name
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      expect(monthNames).toContain(data.month);
      expect(data.month).toBe(monthNames[salaryData.month - 1]);

      // Clean up after test
      await SalaryRecord.deleteMany({ employeeId: salaryData.employeeId });
    }), { numRuns: 20 }); // Reduced runs for API tests
  });

  test('should maintain response structure consistency across multiple requests', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(validSalaryDataGen, { minLength: 2, maxLength: 5 }),
      async (salaryDataArray) => {
        const responses = [];

        // Make multiple requests
        for (let i = 0; i < salaryDataArray.length; i++) {
          const salaryData = { ...salaryDataArray[i], employeeId: `EMP${i}_${Date.now()}` };
          const response = await request(app)
            .post('/api/addSalary')
            .send(salaryData);
          responses.push(response);
        }

        // Property: All responses should have identical structure
        const firstResponseKeys = Object.keys(responses[0].body).sort();
        const firstDataKeys = Object.keys(responses[0].body.data).sort();
        const firstCalcKeys = Object.keys(responses[0].body.calculations).sort();

        for (const response of responses) {
          expect(Object.keys(response.body).sort()).toEqual(firstResponseKeys);
          expect(Object.keys(response.body.data).sort()).toEqual(firstDataKeys);
          expect(Object.keys(response.body.calculations).sort()).toEqual(firstCalcKeys);
        }

        // Clean up
        for (const response of responses) {
          await SalaryRecord.deleteMany({ employeeId: response.body.data.employeeId });
        }
      }
    ), { numRuns: 10 });
  });
});

/**
 * Property 9: Input validation consistency
 * Feature: salary-tracker-system, Property 9: Input validation consistency
 * Validates: Requirements 5.5, 6.5
 */
describe('Property 9: Input validation consistency', () => {
  // Generator for invalid input scenarios
  const invalidInputGen = fc.oneof(
    // Missing required fields
    fc.record({
      employeeName: fc.string({ minLength: 1 }),
      month: fc.integer({ min: 1, max: 12 }),
      year: fc.integer({ min: 2020, max: 2030 }),
      totalMonthlySalary: fc.integer({ min: 1000, max: 100000 }),
      advanceAmountPaid: fc.integer({ min: 0, max: 50000 }),
      paymentDate: fc.date().map(d => d.toISOString())
      // Missing employeeId
    }),
    // Invalid field types
    fc.record({
      employeeId: fc.string({ minLength: 1 }),
      employeeName: fc.integer(), // Should be string
      month: fc.integer({ min: 1, max: 12 }),
      year: fc.integer({ min: 2020, max: 2030 }),
      totalMonthlySalary: fc.integer({ min: 1000, max: 100000 }),
      advanceAmountPaid: fc.integer({ min: 0, max: 50000 }),
      paymentDate: fc.date().map(d => d.toISOString())
    }),
    // Invalid ranges
    fc.record({
      employeeId: fc.string({ minLength: 1 }),
      employeeName: fc.string({ minLength: 1 }),
      month: fc.integer({ min: 13, max: 20 }), // Invalid month
      year: fc.integer({ min: 2020, max: 2030 }),
      totalMonthlySalary: fc.integer({ min: 1000, max: 100000 }),
      advanceAmountPaid: fc.integer({ min: 0, max: 50000 }),
      paymentDate: fc.date().map(d => d.toISOString())
    })
  );

  test('should consistently return 400 status for invalid inputs', async () => {
    await fc.assert(fc.asyncProperty(invalidInputGen, async (invalidData) => {
      const response = await request(app)
        .post('/api/addSalary')
        .send(invalidData);

      // Property: Invalid input should always return 400
      expect(response.status).toBe(400);

      // Property: Error response should have consistent structure
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');

      // Property: Should include field information when applicable
      if (response.body.field) {
        expect(typeof response.body.field).toBe('string');
      }

      // Property: Error message should be descriptive
      expect(response.body.error.length).toBeGreaterThan(0);
    }), { numRuns: 20 });
  });

  test('should provide consistent error messages for same validation failures', async () => {
    // Test specific validation scenarios multiple times
    const testCases = [
      { data: { /* missing employeeId */ }, expectedField: 'employeeId' },
      { data: { employeeId: 'EMP001', month: 13 }, expectedField: 'month' },
      { data: { employeeId: 'EMP001', month: 1, totalMonthlySalary: 'invalid' }, expectedField: 'totalMonthlySalary' }
    ];

    for (const testCase of testCases) {
      const responses = [];
      
      // Make multiple identical requests
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/addSalary')
          .send(testCase.data);
        responses.push(response);
      }

      // Property: All responses should be identical for same input
      const firstResponse = responses[0];
      for (const response of responses) {
        expect(response.status).toBe(firstResponse.status);
        expect(response.body.error).toBe(firstResponse.body.error);
        if (firstResponse.body.field) {
          expect(response.body.field).toBe(firstResponse.body.field);
        }
      }
    }
  });
});

describe('Salary Query Routes', () => {
  // Test data setup
  const testRecords = [
    {
      employeeId: 'EMP001',
      employeeName: 'John Doe',
      month: 10,
      year: 2023,
      totalMonthlySalary: 5000,
      advanceAmountPaid: 2000,
      paymentDate: '2023-10-15T00:00:00.000Z'
    },
    {
      employeeId: 'EMP001',
      employeeName: 'John Doe',
      month: 11,
      year: 2023,
      totalMonthlySalary: 5000,
      advanceAmountPaid: 5000,
      paymentDate: '2023-11-15T00:00:00.000Z'
    },
    {
      employeeId: 'EMP002',
      employeeName: 'Jane Smith',
      month: 10,
      year: 2023,
      totalMonthlySalary: 6000,
      advanceAmountPaid: 0,
      paymentDate: '2023-10-15T00:00:00.000Z'
    }
  ];

  beforeEach(async () => {
    // Clean up and create test data
    await SalaryRecord.deleteMany({});
    
    for (const record of testRecords) {
      await request(app)
        .post('/api/addSalary')
        .send(record);
    }
  });

  describe('GET /api/salaries', () => {
    test('should retrieve all salary records', async () => {
      const response = await request(app)
        .get('/api/salaries')
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination.total).toBe(3);
      expect(response.body.pagination.hasMore).toBe(false);
    });

    test('should filter by employee ID', async () => {
      const response = await request(app)
        .get('/api/salaries?employeeId=EMP001')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach(record => {
        expect(record.employeeId).toBe('EMP001');
      });
    });

    test('should filter by month', async () => {
      const response = await request(app)
        .get('/api/salaries?month=October')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach(record => {
        expect(record.month).toBe('October');
      });
    });

    test('should filter by year', async () => {
      const response = await request(app)
        .get('/api/salaries?year=2023')
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      response.body.data.forEach(record => {
        expect(record.year).toBe(2023);
      });
    });

    test('should filter by payment status', async () => {
      const response = await request(app)
        .get('/api/salaries?paymentStatus=Partially Paid')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].paymentStatus).toBe('Partially Paid');
    });

    test('should handle multiple filters', async () => {
      const response = await request(app)
        .get('/api/salaries?employeeId=EMP001&paymentStatus=Paid')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].employeeId).toBe('EMP001');
      expect(response.body.data[0].paymentStatus).toBe('Paid');
    });

    test('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/salaries?limit=2&skip=1')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.skip).toBe(1);
      expect(response.body.pagination.total).toBe(3);
      expect(response.body.pagination.hasMore).toBe(false);
    });

    test('should return 400 for invalid month', async () => {
      const response = await request(app)
        .get('/api/salaries?month=InvalidMonth')
        .expect(400);

      expect(response.body.error).toContain('Invalid month');
      expect(response.body.field).toBe('month');
    });

    test('should return 400 for invalid year', async () => {
      const response = await request(app)
        .get('/api/salaries?year=1999')
        .expect(400);

      expect(response.body.error).toContain('Invalid year');
      expect(response.body.field).toBe('year');
    });

    test('should return 400 for invalid payment status', async () => {
      const response = await request(app)
        .get('/api/salaries?paymentStatus=InvalidStatus')
        .expect(400);

      expect(response.body.error).toContain('Invalid payment status');
      expect(response.body.field).toBe('paymentStatus');
    });

    test('should return 400 for invalid limit', async () => {
      const response = await request(app)
        .get('/api/salaries?limit=101')
        .expect(400);

      expect(response.body.error).toContain('Invalid limit');
      expect(response.body.field).toBe('limit');
    });
  });

  describe('GET /api/salaries/:id', () => {
    test('should retrieve salary record by ID', async () => {
      // First create a record to get its ID
      const createResponse = await request(app)
        .post('/api/addSalary')
        .send({
          employeeId: 'EMP999',
          employeeName: 'Test Employee',
          month: 12,
          year: 2023,
          totalMonthlySalary: 4000,
          advanceAmountPaid: 1000,
          paymentDate: '2023-12-15T00:00:00.000Z'
        });

      const recordId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/salaries/${recordId}`)
        .expect(200);

      expect(response.body.data._id).toBe(recordId);
      expect(response.body.data.employeeId).toBe('EMP999');
      expect(response.body.data.totalMonthlySalary).toBe(4000);
    });

    test('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .get('/api/salaries/invalid-id')
        .expect(400);

      expect(response.body.error).toContain('Invalid ID format');
      expect(response.body.field).toBe('id');
    });

    test('should return 404 for non-existent ID', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/salaries/${nonExistentId}`)
        .expect(404);

      expect(response.body.error).toBe('Salary record not found');
      expect(response.body.id).toBe(nonExistentId);
    });
  });

  describe('GET /api/employees/:employeeId/salaries', () => {
    test('should retrieve all salary records for an employee', async () => {
      const response = await request(app)
        .get('/api/employees/EMP001/salaries')
        .expect(200);

      expect(response.body.employeeId).toBe('EMP001');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.summary.totalRecords).toBe(2);
      expect(response.body.summary.totalSalary).toBe(10000);
      expect(response.body.summary.totalAdvances).toBe(7000);
      expect(response.body.summary.totalRemaining).toBe(3000);

      response.body.data.forEach(record => {
        expect(record.employeeId).toBe('EMP001');
      });
    });

    test('should filter employee records by year', async () => {
      const response = await request(app)
        .get('/api/employees/EMP001/salaries?year=2023')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach(record => {
        expect(record.year).toBe(2023);
      });
    });

    test('should filter employee records by payment status', async () => {
      const response = await request(app)
        .get('/api/employees/EMP001/salaries?paymentStatus=Paid')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].paymentStatus).toBe('Paid');
    });

    test('should return empty array for non-existent employee', async () => {
      const response = await request(app)
        .get('/api/employees/NONEXISTENT/salaries')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.summary.totalRecords).toBe(0);
    });

    test('should include summary statistics', async () => {
      const response = await request(app)
        .get('/api/employees/EMP001/salaries')
        .expect(200);

      expect(response.body.summary).toHaveProperty('totalRecords');
      expect(response.body.summary).toHaveProperty('totalSalary');
      expect(response.body.summary).toHaveProperty('totalAdvances');
      expect(response.body.summary).toHaveProperty('totalRemaining');
      expect(response.body.summary).toHaveProperty('statusCounts');

      expect(response.body.summary.statusCounts).toHaveProperty('Partially Paid');
      expect(response.body.summary.statusCounts).toHaveProperty('Paid');
    });

    test('should return 400 for invalid year in employee query', async () => {
      const response = await request(app)
        .get('/api/employees/EMP001/salaries?year=1999')
        .expect(400);

      expect(response.body.error).toContain('Invalid year');
      expect(response.body.field).toBe('year');
    });
  });
});