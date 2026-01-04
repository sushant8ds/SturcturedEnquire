/**
 * Salary System Integration Tests
 * 
 * End-to-end integration tests that verify the complete data flow
 * from API endpoints through business logic to database persistence.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../index');
const SalaryRecord = require('../../models/SalaryRecord');

// Test database setup
const MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/salary-tracker-integration-test';

describe('Salary System Integration Tests', () => {
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

  describe('Complete Salary Record Lifecycle', () => {
    test('should handle complete salary record creation and retrieval flow', async () => {
      const salaryData = {
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        month: 10,
        year: 2023,
        totalMonthlySalary: 5000,
        advanceAmountPaid: 2000,
        paymentDate: '2023-10-15T00:00:00.000Z'
      };

      // Step 1: Create salary record via API
      const createResponse = await request(app)
        .post('/api/addSalary')
        .send(salaryData)
        .expect(201);

      // Verify API response structure
      expect(createResponse.body.message).toBe('Salary record created successfully');
      expect(createResponse.body.data).toMatchObject({
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        month: 'October',
        year: 2023,
        totalMonthlySalary: 5000,
        advanceAmountPaid: 2000,
        remainingSalaryPayable: 3000,
        paymentStatus: 'Partially Paid'
      });

      const recordId = createResponse.body.data.id;

      // Step 2: Verify record exists in database
      const dbRecord = await SalaryRecord.findById(recordId);
      expect(dbRecord).toBeTruthy();
      expect(dbRecord.employeeId).toBe('EMP001');
      expect(dbRecord.remainingSalaryPayable).toBe(3000);
      expect(dbRecord.paymentStatus).toBe('Partially Paid');

      // Step 3: Retrieve record via API by ID
      const getByIdResponse = await request(app)
        .get(`/api/salaries/${recordId}`)
        .expect(200);

      expect(getByIdResponse.body.data._id).toBe(recordId);
      expect(getByIdResponse.body.data.employeeId).toBe('EMP001');

      // Step 4: Retrieve records via general query
      const getAllResponse = await request(app)
        .get('/api/salaries')
        .expect(200);

      expect(getAllResponse.body.data).toHaveLength(1);
      expect(getAllResponse.body.data[0]._id).toBe(recordId);

      // Step 5: Query by employee ID
      const getByEmployeeResponse = await request(app)
        .get('/api/employees/EMP001/salaries')
        .expect(200);

      expect(getByEmployeeResponse.body.employeeId).toBe('EMP001');
      expect(getByEmployeeResponse.body.data).toHaveLength(1);
      expect(getByEmployeeResponse.body.summary.totalRecords).toBe(1);
      expect(getByEmployeeResponse.body.summary.totalSalary).toBe(5000);
    });

    test('should handle multiple salary records for same employee', async () => {
      const salaryRecords = [
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
          employeeId: 'EMP001',
          employeeName: 'John Doe',
          month: 12,
          year: 2023,
          totalMonthlySalary: 5000,
          advanceAmountPaid: 0,
          paymentDate: '2023-12-15T00:00:00.000Z'
        }
      ];

      // Create multiple records
      const createdRecords = [];
      for (const record of salaryRecords) {
        const response = await request(app)
          .post('/api/addSalary')
          .send(record)
          .expect(201);
        createdRecords.push(response.body.data);
      }

      // Verify all records exist
      expect(createdRecords).toHaveLength(3);

      // Query employee summary
      const summaryResponse = await request(app)
        .get('/api/employees/EMP001/salaries')
        .expect(200);

      expect(summaryResponse.body.data).toHaveLength(3);
      expect(summaryResponse.body.summary.totalRecords).toBe(3);
      expect(summaryResponse.body.summary.totalSalary).toBe(15000);
      expect(summaryResponse.body.summary.totalAdvances).toBe(7000);
      expect(summaryResponse.body.summary.totalRemaining).toBe(8000);

      // Verify status counts
      expect(summaryResponse.body.summary.statusCounts).toEqual({
        'Partially Paid': 1,
        'Paid': 1,
        'Pending': 1
      });
    });

    test('should handle business rule validation across all layers', async () => {
      const invalidSalaryData = {
        employeeId: 'EMP002',
        employeeName: 'Jane Smith',
        month: 10,
        year: 2023,
        totalMonthlySalary: 3000,
        advanceAmountPaid: 5000, // Exceeds total salary
        paymentDate: '2023-10-15T00:00:00.000Z'
      };

      // API should reject invalid data
      const response = await request(app)
        .post('/api/addSalary')
        .send(invalidSalaryData)
        .expect(400);

      expect(response.body.error).toContain('cannot exceed total monthly salary');

      // Verify no record was created in database
      const dbRecords = await SalaryRecord.find({ employeeId: 'EMP002' });
      expect(dbRecords).toHaveLength(0);
    });

    test('should handle database errors gracefully', async () => {
      // Create a record first
      const salaryData = {
        employeeId: 'EMP003',
        employeeName: 'Bob Wilson',
        month: 10,
        year: 2023,
        totalMonthlySalary: 4000,
        advanceAmountPaid: 1000,
        paymentDate: '2023-10-15T00:00:00.000Z'
      };

      await request(app)
        .post('/api/addSalary')
        .send(salaryData)
        .expect(201);

      // Try to create duplicate record (should fail due to unique constraint)
      const duplicateResponse = await request(app)
        .post('/api/addSalary')
        .send(salaryData)
        .expect(400);

      expect(duplicateResponse.body.error).toContain('already exists');
    });

    test('should maintain data consistency during concurrent operations', async () => {
      const employeeRecords = [
        {
          employeeId: 'EMP004',
          employeeName: 'Alice Johnson',
          month: 10,
          year: 2023,
          totalMonthlySalary: 6000,
          advanceAmountPaid: 3000,
          paymentDate: '2023-10-15T00:00:00.000Z'
        },
        {
          employeeId: 'EMP005',
          employeeName: 'Charlie Brown',
          month: 10,
          year: 2023,
          totalMonthlySalary: 7000,
          advanceAmountPaid: 2000,
          paymentDate: '2023-10-15T00:00:00.000Z'
        },
        {
          employeeId: 'EMP006',
          employeeName: 'Diana Prince',
          month: 10,
          year: 2023,
          totalMonthlySalary: 8000,
          advanceAmountPaid: 8000,
          paymentDate: '2023-10-15T00:00:00.000Z'
        }
      ];

      // Create records concurrently
      const createPromises = employeeRecords.map(record =>
        request(app).post('/api/addSalary').send(record)
      );

      const responses = await Promise.all(createPromises);

      // Verify all records were created successfully
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify all records exist in database
      const dbRecords = await SalaryRecord.find({
        employeeId: { $in: ['EMP004', 'EMP005', 'EMP006'] }
      });
      expect(dbRecords).toHaveLength(3);

      // Verify calculations are correct for each record
      const emp004 = dbRecords.find(r => r.employeeId === 'EMP004');
      expect(emp004.remainingSalaryPayable).toBe(3000);
      expect(emp004.paymentStatus).toBe('Partially Paid');

      const emp005 = dbRecords.find(r => r.employeeId === 'EMP005');
      expect(emp005.remainingSalaryPayable).toBe(5000);
      expect(emp005.paymentStatus).toBe('Partially Paid');

      const emp006 = dbRecords.find(r => r.employeeId === 'EMP006');
      expect(emp006.remainingSalaryPayable).toBe(0);
      expect(emp006.paymentStatus).toBe('Paid');
    });

    test('should handle filtering and pagination correctly', async () => {
      // Create test data with different statuses and dates
      const testRecords = [
        {
          employeeId: 'EMP007',
          employeeName: 'Test Employee 1',
          month: 10,
          year: 2023,
          totalMonthlySalary: 5000,
          advanceAmountPaid: 0,
          paymentDate: '2023-10-15T00:00:00.000Z'
        },
        {
          employeeId: 'EMP008',
          employeeName: 'Test Employee 2',
          month: 10,
          year: 2023,
          totalMonthlySalary: 6000,
          advanceAmountPaid: 3000,
          paymentDate: '2023-10-15T00:00:00.000Z'
        },
        {
          employeeId: 'EMP009',
          employeeName: 'Test Employee 3',
          month: 11,
          year: 2023,
          totalMonthlySalary: 7000,
          advanceAmountPaid: 7000,
          paymentDate: '2023-11-15T00:00:00.000Z'
        }
      ];

      // Create all records
      for (const record of testRecords) {
        await request(app)
          .post('/api/addSalary')
          .send(record)
          .expect(201);
      }

      // Test filtering by month
      const octoberRecords = await request(app)
        .get('/api/salaries?month=October')
        .expect(200);
      expect(octoberRecords.body.data).toHaveLength(2);

      // Test filtering by payment status
      const pendingRecords = await request(app)
        .get('/api/salaries?paymentStatus=Pending')
        .expect(200);
      expect(pendingRecords.body.data).toHaveLength(1);
      expect(pendingRecords.body.data[0].employeeId).toBe('EMP007');

      // Test pagination
      const paginatedRecords = await request(app)
        .get('/api/salaries?limit=2&skip=1')
        .expect(200);
      expect(paginatedRecords.body.data).toHaveLength(2);
      expect(paginatedRecords.body.pagination.total).toBe(3);
      expect(paginatedRecords.body.pagination.hasMore).toBe(false);
    });

    test('should handle decimal precision throughout the system', async () => {
      const precisionTestData = {
        employeeId: 'EMP010',
        employeeName: 'Precision Test',
        month: 10,
        year: 2023,
        totalMonthlySalary: 5000.99,
        advanceAmountPaid: 2000.49,
        paymentDate: '2023-10-15T00:00:00.000Z'
      };

      // Create record with decimal values
      const response = await request(app)
        .post('/api/addSalary')
        .send(precisionTestData)
        .expect(201);

      // Verify precision is maintained
      expect(response.body.data.totalMonthlySalary).toBe(5000.99);
      expect(response.body.data.advanceAmountPaid).toBe(2000.49);
      expect(response.body.data.remainingSalaryPayable).toBe(3000.50);

      // Verify in database
      const dbRecord = await SalaryRecord.findById(response.body.data.id);
      expect(dbRecord.totalMonthlySalary).toBe(5000.99);
      expect(dbRecord.advanceAmountPaid).toBe(2000.49);
      expect(dbRecord.remainingSalaryPayable).toBe(3000.50);

      // Verify through query API
      const queryResponse = await request(app)
        .get(`/api/salaries/${response.body.data.id}`)
        .expect(200);

      expect(queryResponse.body.data.totalMonthlySalary).toBe(5000.99);
      expect(queryResponse.body.data.remainingSalaryPayable).toBe(3000.50);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network timeouts gracefully', async () => {
      // This test would require mocking network delays
      // For now, we'll test that the API responds within reasonable time
      const startTime = Date.now();
      
      await request(app)
        .get('/api/salaries')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    test('should maintain system stability under load', async () => {
      // Create multiple concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        employeeId: `LOAD_TEST_${i}`,
        employeeName: `Load Test Employee ${i}`,
        month: 10,
        year: 2023,
        totalMonthlySalary: 5000 + i * 100,
        advanceAmountPaid: 1000 + i * 50,
        paymentDate: '2023-10-15T00:00:00.000Z'
      }));

      const promises = concurrentRequests.map(record =>
        request(app).post('/api/addSalary').send(record)
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.data.employeeId).toBe(`LOAD_TEST_${index}`);
      });

      // Verify all records were created
      const dbRecords = await SalaryRecord.find({
        employeeId: { $regex: /^LOAD_TEST_/ }
      });
      expect(dbRecords).toHaveLength(10);
    });
  });
});