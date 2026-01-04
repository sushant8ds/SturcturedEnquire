const mongoose = require('mongoose');
const fc = require('fast-check');
const SalaryRecord = require('../../models/SalaryRecord');

describe('SalaryRecord Model Schema Validation', () => {
  // Property Test Generators
  const validEmployeeIdGen = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
  const validEmployeeNameGen = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
  const validMonthGen = fc.constantFrom(
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  );
  const validYearGen = fc.integer({ min: 2000, max: 2100 });
  // Use integers for monetary values to avoid floating point precision issues
  const validSalaryGen = fc.integer({ min: 0, max: 10000000 }).map(n => n / 100); // Convert cents to dollars
  const validDateGen = fc.date({ min: new Date('2000-01-01'), max: new Date('2025-12-31') });

  const validSalaryRecordGen = fc.record({
    employeeId: validEmployeeIdGen,
    employeeName: validEmployeeNameGen,
    month: validMonthGen,
    year: validYearGen,
    totalMonthlySalary: validSalaryGen,
    paymentDate: validDateGen
  }).chain(base => {
    // Generate advance amount as integer cents, then convert to dollars
    const totalCents = Math.round(base.totalMonthlySalary * 100);
    return fc.integer({ min: 0, max: totalCents }).map(advanceCents => ({
      ...base,
      advanceAmountPaid: advanceCents / 100
    }));
  });

  /**
   * Property 6: Schema field completeness
   * Feature: salary-tracker-system, Property 6: Schema field completeness
   * Validates: Requirements 6.2, 1.1
   */
  describe('Property 6: Schema field completeness', () => {
    test('should validate all required fields are present in schema', () => {
      fc.assert(fc.property(validSalaryRecordGen, (recordData) => {
        const salaryRecord = new SalaryRecord(recordData);
        
        // Calculate derived fields for testing
        salaryRecord.calculateDerivedFields();
        
        // Verify all required fields are present in the document
        expect(salaryRecord.employeeId).toBeDefined();
        expect(salaryRecord.employeeName).toBeDefined();
        expect(salaryRecord.month).toBeDefined();
        expect(salaryRecord.year).toBeDefined();
        expect(salaryRecord.totalMonthlySalary).toBeDefined();
        expect(salaryRecord.advanceAmountPaid).toBeDefined();
        expect(salaryRecord.paymentDate).toBeDefined();
        expect(salaryRecord.remainingSalaryPayable).toBeDefined();
        expect(salaryRecord.paymentStatus).toBeDefined();
        
        // Verify field types match expected types
        expect(typeof salaryRecord.employeeId).toBe('string');
        expect(typeof salaryRecord.employeeName).toBe('string');
        expect(typeof salaryRecord.month).toBe('string');
        expect(typeof salaryRecord.year).toBe('number');
        expect(typeof salaryRecord.totalMonthlySalary).toBe('number');
        expect(typeof salaryRecord.advanceAmountPaid).toBe('number');
        expect(salaryRecord.paymentDate).toBeInstanceOf(Date);
        expect(typeof salaryRecord.remainingSalaryPayable).toBe('number');
        expect(typeof salaryRecord.paymentStatus).toBe('string');
        
        // Verify calculated fields are computed correctly (accounting for rounding)
        const expectedRemaining = Math.round((salaryRecord.totalMonthlySalary - salaryRecord.advanceAmountPaid) * 100) / 100;
        expect(salaryRecord.remainingSalaryPayable).toBe(expectedRemaining);
        
        // Verify payment status is determined correctly
        let expectedStatus;
        if (expectedRemaining === 0) {
          expectedStatus = 'Paid';
        } else if (salaryRecord.advanceAmountPaid > 0 && expectedRemaining > 0) {
          expectedStatus = 'Partially Paid';
        } else if (salaryRecord.advanceAmountPaid === 0) {
          expectedStatus = 'Pending';
        }
        expect(salaryRecord.paymentStatus).toBe(expectedStatus);
        
        // Verify enum constraints
        const validMonths = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        expect(validMonths).toContain(salaryRecord.month);
        
        const validStatuses = ['Pending', 'Partially Paid', 'Paid'];
        expect(validStatuses).toContain(salaryRecord.paymentStatus);
      }), { numRuns: 100 });
    });

    test('should validate field constraints', () => {
      fc.assert(fc.property(validSalaryRecordGen, (recordData) => {
        const salaryRecord = new SalaryRecord(recordData);
        
        // Validate string length constraints
        expect(salaryRecord.employeeId.length).toBeGreaterThan(0);
        expect(salaryRecord.employeeId.length).toBeLessThanOrEqual(50);
        expect(salaryRecord.employeeName.length).toBeGreaterThan(0);
        expect(salaryRecord.employeeName.length).toBeLessThanOrEqual(100);
        
        // Validate numeric constraints
        expect(salaryRecord.year).toBeGreaterThanOrEqual(2000);
        expect(salaryRecord.year).toBeLessThanOrEqual(2100);
        expect(Number.isInteger(salaryRecord.year)).toBe(true);
        
        expect(salaryRecord.totalMonthlySalary).toBeGreaterThanOrEqual(0);
        expect(salaryRecord.advanceAmountPaid).toBeGreaterThanOrEqual(0);
        expect(salaryRecord.advanceAmountPaid).toBeLessThanOrEqual(salaryRecord.totalMonthlySalary);
        
        // Validate monetary precision (2 decimal places) - allow for floating point precision
        expect(Math.abs(Math.round(salaryRecord.totalMonthlySalary * 100) - (salaryRecord.totalMonthlySalary * 100))).toBeLessThan(0.01);
        expect(Math.abs(Math.round(salaryRecord.advanceAmountPaid * 100) - (salaryRecord.advanceAmountPaid * 100))).toBeLessThan(0.01);
        
        // Validate date constraints (use getTime() for comparison)
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        expect(salaryRecord.paymentDate.getTime()).toBeLessThanOrEqual(oneYearFromNow.getTime());
      }), { numRuns: 100 });
    });

    test('should handle validation errors for invalid data', () => {
      // Test invalid employee ID (empty string)
      expect(() => {
        const record = new SalaryRecord({
          employeeId: '',
          employeeName: 'John Doe',
          month: 'January',
          year: 2024,
          totalMonthlySalary: 5000,
          advanceAmountPaid: 1000,
          paymentDate: new Date()
        });
        const validation = record.validateSync();
        if (validation) throw validation;
      }).toThrow();

      // Test invalid month
      expect(() => {
        const record = new SalaryRecord({
          employeeId: 'EMP001',
          employeeName: 'John Doe',
          month: 'InvalidMonth',
          year: 2024,
          totalMonthlySalary: 5000,
          advanceAmountPaid: 1000,
          paymentDate: new Date()
        });
        const validation = record.validateSync();
        if (validation) throw validation;
      }).toThrow();

      // Test invalid year (too low)
      expect(() => {
        const record = new SalaryRecord({
          employeeId: 'EMP001',
          employeeName: 'John Doe',
          month: 'January',
          year: 1999,
          totalMonthlySalary: 5000,
          advanceAmountPaid: 1000,
          paymentDate: new Date()
        });
        const validation = record.validateSync();
        if (validation) throw validation;
      }).toThrow();

      // Test negative salary
      expect(() => {
        const record = new SalaryRecord({
          employeeId: 'EMP001',
          employeeName: 'John Doe',
          month: 'January',
          year: 2024,
          totalMonthlySalary: -5000,
          advanceAmountPaid: 1000,
          paymentDate: new Date()
        });
        const validation = record.validateSync();
        if (validation) throw validation;
      }).toThrow();

      // Test advance exceeding salary
      expect(() => {
        const record = new SalaryRecord({
          employeeId: 'EMP001',
          employeeName: 'John Doe',
          month: 'January',
          year: 2024,
          totalMonthlySalary: 5000,
          advanceAmountPaid: 6000,
          paymentDate: new Date()
        });
        const validation = record.validateSync();
        if (validation) throw validation;
      }).toThrow();
    });
  });

  // Unit tests for specific edge cases
  describe('Edge Cases', () => {
    test('should handle zero advance amount', () => {
      const recordData = {
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        month: 'January',
        year: 2024,
        totalMonthlySalary: 5000.00,
        advanceAmountPaid: 0.00,
        paymentDate: new Date('2024-01-15')
      };

      const salaryRecord = new SalaryRecord(recordData);
      salaryRecord.calculateDerivedFields();
      
      expect(salaryRecord.remainingSalaryPayable).toBe(5000.00);
      expect(salaryRecord.paymentStatus).toBe('Pending');
    });

    test('should handle full salary advance', () => {
      const recordData = {
        employeeId: 'EMP002',
        employeeName: 'Jane Smith',
        month: 'February',
        year: 2024,
        totalMonthlySalary: 4000.00,
        advanceAmountPaid: 4000.00,
        paymentDate: new Date('2024-02-15')
      };

      const salaryRecord = new SalaryRecord(recordData);
      salaryRecord.calculateDerivedFields();
      
      expect(salaryRecord.remainingSalaryPayable).toBe(0.00);
      expect(salaryRecord.paymentStatus).toBe('Paid');
    });

    test('should handle partial advance payment', () => {
      const recordData = {
        employeeId: 'EMP003',
        employeeName: 'Bob Johnson',
        month: 'March',
        year: 2024,
        totalMonthlySalary: 6000.00,
        advanceAmountPaid: 2500.00,
        paymentDate: new Date('2024-03-15')
      };

      const salaryRecord = new SalaryRecord(recordData);
      salaryRecord.calculateDerivedFields();
      
      expect(salaryRecord.remainingSalaryPayable).toBe(3500.00);
      expect(salaryRecord.paymentStatus).toBe('Partially Paid');
    });

    test('should validate virtual properties', () => {
      const recordData = {
        employeeId: 'EMP004',
        employeeName: 'Alice Brown',
        month: 'April',
        year: 2024,
        totalMonthlySalary: 7500.50,
        advanceAmountPaid: 2000.25,
        paymentDate: new Date('2024-04-15')
      };

      const salaryRecord = new SalaryRecord(recordData);
      salaryRecord.calculateDerivedFields();
      
      expect(salaryRecord.formattedPaymentDate).toBe('4/15/2024');
      expect(salaryRecord.formattedAmounts.totalSalary).toBe('$7500.50');
      expect(salaryRecord.formattedAmounts.advancePaid).toBe('$2000.25');
      expect(salaryRecord.formattedAmounts.remainingPayable).toBe('$5500.25');
    });
  });

  /**
   * Property 5: Automatic timestamp generation
   * Feature: salary-tracker-system, Property 5: Automatic timestamp generation
   * Validates: Requirements 1.3, 6.4
   */
  describe('Property 5: Automatic timestamp generation', () => {
    test('should have timestamp fields configured in schema', () => {
      fc.assert(fc.property(validSalaryRecordGen, (recordData) => {
        const salaryRecord = new SalaryRecord(recordData);
        
        // Verify that the schema has timestamps enabled
        expect(SalaryRecord.schema.options.timestamps).toBe(true);
        
        // Verify that timestamp fields are defined in the schema paths
        expect(SalaryRecord.schema.paths.createdAt).toBeDefined();
        expect(SalaryRecord.schema.paths.updatedAt).toBeDefined();
        
        // Verify timestamp field types in schema
        expect(SalaryRecord.schema.paths.createdAt.instance).toBe('Date');
        expect(SalaryRecord.schema.paths.updatedAt.instance).toBe('Date');
        
        // Verify that timestamp fields are present in the document structure
        // (even if undefined before save)
        expect(salaryRecord.schema.paths.createdAt).toBeDefined();
        expect(salaryRecord.schema.paths.updatedAt).toBeDefined();
      }), { numRuns: 100 });
    });

    test('should include timestamp fields in document toObject output', () => {
      fc.assert(fc.property(validSalaryRecordGen, (recordData) => {
        const salaryRecord = new SalaryRecord(recordData);
        
        // Calculate derived fields to avoid undefined values
        salaryRecord.calculateDerivedFields();
        
        // Manually set timestamps to simulate what Mongoose would do on save
        const now = new Date();
        salaryRecord.createdAt = now;
        salaryRecord.updatedAt = now;
        
        const docObject = salaryRecord.toObject();
        
        // Verify timestamps are included in object representation
        expect(docObject.createdAt).toBeInstanceOf(Date);
        expect(docObject.updatedAt).toBeInstanceOf(Date);
        expect(docObject.createdAt).toEqual(now);
        expect(docObject.updatedAt).toEqual(now);
      }), { numRuns: 100 });
    });

    test('should include timestamp fields in JSON serialization', () => {
      fc.assert(fc.property(validSalaryRecordGen, (recordData) => {
        const salaryRecord = new SalaryRecord(recordData);
        
        // Calculate derived fields to avoid undefined values
        salaryRecord.calculateDerivedFields();
        
        // Manually set timestamps to simulate what Mongoose would do on save
        const now = new Date();
        salaryRecord.createdAt = now;
        salaryRecord.updatedAt = now;
        
        const jsonDoc = salaryRecord.toJSON();
        
        // Verify timestamps are included in JSON representation
        expect(jsonDoc.createdAt).toBeDefined();
        expect(jsonDoc.updatedAt).toBeDefined();
        
        // Verify timestamps are Date objects in toJSON output (Mongoose behavior)
        expect(jsonDoc.createdAt).toBeInstanceOf(Date);
        expect(jsonDoc.updatedAt).toBeInstanceOf(Date);
        
        // Verify timestamps can be converted to valid ISO strings
        expect(jsonDoc.createdAt.toISOString()).toBeDefined();
        expect(jsonDoc.updatedAt.toISOString()).toBeDefined();
        expect(new Date(jsonDoc.createdAt.toISOString())).toEqual(now);
        expect(new Date(jsonDoc.updatedAt.toISOString())).toEqual(now);
      }), { numRuns: 100 });
    });

    test('should validate timestamp field behavior when manually set', () => {
      fc.assert(fc.property(validSalaryRecordGen, (recordData) => {
        const salaryRecord = new SalaryRecord(recordData);
        
        // Test setting valid timestamps
        const now = new Date();
        const earlier = new Date(now.getTime() - 1000);
        
        salaryRecord.createdAt = earlier;
        salaryRecord.updatedAt = now;
        
        // Verify timestamps are set correctly
        expect(salaryRecord.createdAt).toEqual(earlier);
        expect(salaryRecord.updatedAt).toEqual(now);
        
        // Verify timestamps maintain their Date type
        expect(salaryRecord.createdAt).toBeInstanceOf(Date);
        expect(salaryRecord.updatedAt).toBeInstanceOf(Date);
        
        // Verify timestamps are not invalid dates
        expect(isNaN(salaryRecord.createdAt.getTime())).toBe(false);
        expect(isNaN(salaryRecord.updatedAt.getTime())).toBe(false);
      }), { numRuns: 100 });
    });
  });

  // Unit tests for specific timestamp scenarios
  describe('Timestamp Edge Cases', () => {
    test('should have timestamps schema configuration', () => {
      // Verify schema-level timestamp configuration
      expect(SalaryRecord.schema.options.timestamps).toBe(true);
      
      // Verify timestamp fields exist in schema
      expect(SalaryRecord.schema.paths.createdAt).toBeDefined();
      expect(SalaryRecord.schema.paths.updatedAt).toBeDefined();
      
      // Verify timestamp field types
      expect(SalaryRecord.schema.paths.createdAt.instance).toBe('Date');
      expect(SalaryRecord.schema.paths.updatedAt.instance).toBe('Date');
    });

    test('should handle timestamp assignment and retrieval', () => {
      const recordData = {
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        month: 'January',
        year: 2024,
        totalMonthlySalary: 5000.00,
        advanceAmountPaid: 1000.00,
        paymentDate: new Date('2024-01-15')
      };

      const salaryRecord = new SalaryRecord(recordData);
      
      // Manually set timestamps (simulating Mongoose behavior)
      const createdTime = new Date('2024-01-01T10:00:00.000Z');
      const updatedTime = new Date('2024-01-01T10:00:01.000Z');
      
      salaryRecord.createdAt = createdTime;
      salaryRecord.updatedAt = updatedTime;

      // Verify timestamps are correctly assigned
      expect(salaryRecord.createdAt).toEqual(createdTime);
      expect(salaryRecord.updatedAt).toEqual(updatedTime);
      
      // Verify timestamps maintain precision
      expect(salaryRecord.createdAt.getTime()).toBe(createdTime.getTime());
      expect(salaryRecord.updatedAt.getTime()).toBe(updatedTime.getTime());
    });

    test('should include timestamps in document transformation', () => {
      const recordData = {
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        month: 'January',
        year: 2024,
        totalMonthlySalary: 5000.00,
        advanceAmountPaid: 1000.00,
        paymentDate: new Date('2024-01-15')
      };

      const salaryRecord = new SalaryRecord(recordData);
      const now = new Date();
      
      // Calculate derived fields and set timestamps
      salaryRecord.calculateDerivedFields();
      salaryRecord.createdAt = now;
      salaryRecord.updatedAt = now;

      // Test toObject transformation
      const objDoc = salaryRecord.toObject();
      expect(objDoc.createdAt).toEqual(now);
      expect(objDoc.updatedAt).toEqual(now);
      
      // Test JSON transformation
      const jsonDoc = salaryRecord.toJSON();
      expect(jsonDoc.createdAt).toBeDefined();
      expect(jsonDoc.updatedAt).toBeDefined();
      
      // Verify JSON serialization format
      expect(jsonDoc.createdAt).toBeInstanceOf(Date);
      expect(jsonDoc.updatedAt).toBeInstanceOf(Date);
      expect(jsonDoc.createdAt).toEqual(now);
      expect(jsonDoc.updatedAt).toEqual(now);
    });

    test('should validate timestamp field constraints', () => {
      const recordData = {
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        month: 'January',
        year: 2024,
        totalMonthlySalary: 5000.00,
        advanceAmountPaid: 1000.00,
        paymentDate: new Date('2024-01-15')
      };

      const salaryRecord = new SalaryRecord(recordData);
      
      // Test with valid dates
      const validDate = new Date('2024-01-15T10:00:00.000Z');
      salaryRecord.createdAt = validDate;
      salaryRecord.updatedAt = validDate;
      
      // Should not throw validation errors
      expect(() => salaryRecord.validateSync()).not.toThrow();
      
      // Verify dates are preserved
      expect(salaryRecord.createdAt).toEqual(validDate);
      expect(salaryRecord.updatedAt).toEqual(validDate);
    });
  });
});

/**
 * Property 4: Data persistence round trip
 * Feature: salary-tracker-system, Property 4: Data persistence round trip
 * Validates: Requirements 1.1, 8.1
 */
describe('Property 4: Data persistence round trip', () => {
  // Generator for valid salary record data
  const validSalaryRecordGen = fc.record({
    employeeId: fc.string({ minLength: 1, maxLength: 20 }).map(s => 'EMP' + s.replace(/[^a-zA-Z0-9]/g, '')),
    employeeName: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z\s]/g, 'A').trim() || 'Employee'),
    month: fc.constantFrom('January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'),
    year: fc.integer({ min: 2020, max: 2025 }),
    totalMonthlySalary: fc.integer({ min: 1000, max: 100000 }).map(n => Math.round(n / 100) * 100), // Round to whole dollars
    paymentDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
  }).chain(base => 
    fc.record({
      employeeId: fc.constant(base.employeeId),
      employeeName: fc.constant(base.employeeName),
      month: fc.constant(base.month),
      year: fc.constant(base.year),
      totalMonthlySalary: fc.constant(base.totalMonthlySalary),
      paymentDate: fc.constant(base.paymentDate),
      advanceAmountPaid: fc.integer({ min: 0, max: base.totalMonthlySalary }).map(n => Math.round(n / 100) * 100)
    })
  );

  test('should persist and retrieve salary records with data integrity', async () => {
    await fc.assert(fc.asyncProperty(validSalaryRecordGen, async (recordData) => {
      // Clean up before test
      await SalaryRecord.deleteMany({ employeeId: recordData.employeeId });

      // Create and save record
      const salaryRecord = new SalaryRecord(recordData);
      const savedRecord = await salaryRecord.save();

      // Property: Saved record should have an ID
      expect(savedRecord._id).toBeDefined();
      expect(savedRecord._id.toString()).toMatch(/^[0-9a-fA-F]{24}$/);

      // Property: All input data should be preserved
      expect(savedRecord.employeeId).toBe(recordData.employeeId);
      expect(savedRecord.employeeName).toBe(recordData.employeeName);
      expect(savedRecord.month).toBe(recordData.month);
      expect(savedRecord.year).toBe(recordData.year);
      expect(savedRecord.totalMonthlySalary).toBe(recordData.totalMonthlySalary);
      expect(savedRecord.advanceAmountPaid).toBe(recordData.advanceAmountPaid);
      expect(savedRecord.paymentDate.toISOString()).toBe(recordData.paymentDate.toISOString());

      // Property: Calculated fields should be computed correctly
      const expectedRemaining = recordData.totalMonthlySalary - recordData.advanceAmountPaid;
      expect(savedRecord.remainingSalaryPayable).toBe(expectedRemaining);

      let expectedStatus;
      if (expectedRemaining === 0) {
        expectedStatus = 'Paid';
      } else if (recordData.advanceAmountPaid > 0 && expectedRemaining > 0) {
        expectedStatus = 'Partially Paid';
      } else if (recordData.advanceAmountPaid === 0) {
        expectedStatus = 'Pending';
      }
      expect(savedRecord.paymentStatus).toBe(expectedStatus);

      // Property: Timestamps should be set
      expect(savedRecord.createdAt).toBeInstanceOf(Date);
      expect(savedRecord.updatedAt).toBeInstanceOf(Date);

      // Retrieve record from database
      const retrievedRecord = await SalaryRecord.findById(savedRecord._id);

      // Property: Retrieved record should match saved record
      expect(retrievedRecord).toBeTruthy();
      expect(retrievedRecord.employeeId).toBe(savedRecord.employeeId);
      expect(retrievedRecord.employeeName).toBe(savedRecord.employeeName);
      expect(retrievedRecord.month).toBe(savedRecord.month);
      expect(retrievedRecord.year).toBe(savedRecord.year);
      expect(retrievedRecord.totalMonthlySalary).toBe(savedRecord.totalMonthlySalary);
      expect(retrievedRecord.advanceAmountPaid).toBe(savedRecord.advanceAmountPaid);
      expect(retrievedRecord.remainingSalaryPayable).toBe(savedRecord.remainingSalaryPayable);
      expect(retrievedRecord.paymentStatus).toBe(savedRecord.paymentStatus);
      expect(retrievedRecord.paymentDate.toISOString()).toBe(savedRecord.paymentDate.toISOString());

      // Clean up after test
      await SalaryRecord.deleteMany({ employeeId: recordData.employeeId });
    }), { numRuns: 20 }); // Reduced runs for database operations
  });

  test('should maintain data consistency across multiple save/retrieve cycles', async () => {
    await fc.assert(fc.asyncProperty(validSalaryRecordGen, async (recordData) => {
      // Clean up before test
      await SalaryRecord.deleteMany({ employeeId: recordData.employeeId });

      // Create original record
      const originalRecord = new SalaryRecord(recordData);
      const savedRecord1 = await originalRecord.save();

      // Retrieve and re-save multiple times
      for (let i = 0; i < 3; i++) {
        const retrieved = await SalaryRecord.findById(savedRecord1._id);
        const reSaved = await retrieved.save();

        // Property: Data should remain consistent across save cycles
        expect(reSaved.employeeId).toBe(recordData.employeeId);
        expect(reSaved.employeeName).toBe(recordData.employeeName);
        expect(reSaved.totalMonthlySalary).toBe(recordData.totalMonthlySalary);
        expect(reSaved.advanceAmountPaid).toBe(recordData.advanceAmountPaid);
        expect(reSaved.remainingSalaryPayable).toBe(recordData.totalMonthlySalary - recordData.advanceAmountPaid);

        // Property: ID should remain the same
        expect(reSaved._id.toString()).toBe(savedRecord1._id.toString());

        // Property: updatedAt should be updated
        expect(reSaved.updatedAt.getTime()).toBeGreaterThanOrEqual(retrieved.updatedAt.getTime());
      }

      // Clean up after test
      await SalaryRecord.deleteMany({ employeeId: recordData.employeeId });
    }), { numRuns: 10 });
  });

  test('should handle concurrent operations correctly', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(validSalaryRecordGen, { minLength: 2, maxLength: 5 }),
      async (recordsData) => {
        // Make employee IDs unique for this test
        const uniqueRecords = recordsData.map((record, index) => ({
          ...record,
          employeeId: `${record.employeeId}_${index}_${Date.now()}`
        }));

        // Clean up before test
        for (const record of uniqueRecords) {
          await SalaryRecord.deleteMany({ employeeId: record.employeeId });
        }

        // Save all records concurrently
        const savePromises = uniqueRecords.map(record => new SalaryRecord(record).save());
        const savedRecords = await Promise.all(savePromises);

        // Property: All records should be saved successfully
        expect(savedRecords).toHaveLength(uniqueRecords.length);

        // Property: Each record should have unique ID
        const ids = savedRecords.map(r => r._id.toString());
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(savedRecords.length);

        // Retrieve all records concurrently
        const retrievePromises = savedRecords.map(record => 
          SalaryRecord.findById(record._id)
        );
        const retrievedRecords = await Promise.all(retrievePromises);

        // Property: All records should be retrievable
        expect(retrievedRecords).toHaveLength(savedRecords.length);
        retrievedRecords.forEach(record => {
          expect(record).toBeTruthy();
        });

        // Property: Retrieved data should match saved data
        for (let i = 0; i < savedRecords.length; i++) {
          const saved = savedRecords[i];
          const retrieved = retrievedRecords[i];
          
          expect(retrieved.employeeId).toBe(saved.employeeId);
          expect(retrieved.totalMonthlySalary).toBe(saved.totalMonthlySalary);
          expect(retrieved.advanceAmountPaid).toBe(saved.advanceAmountPaid);
          expect(retrieved.remainingSalaryPayable).toBe(saved.remainingSalaryPayable);
          expect(retrieved.paymentStatus).toBe(saved.paymentStatus);
        }

        // Clean up after test
        for (const record of uniqueRecords) {
          await SalaryRecord.deleteMany({ employeeId: record.employeeId });
        }
      }
    ), { numRuns: 5 }); // Fewer runs for complex concurrent operations
  });

  test('should validate business rules during persistence', async () => {
    await fc.assert(fc.asyncProperty(validSalaryRecordGen, async (recordData) => {
      // Clean up before test
      await SalaryRecord.deleteMany({ employeeId: recordData.employeeId });

      const salaryRecord = new SalaryRecord(recordData);
      const savedRecord = await salaryRecord.save();

      // Property: Business rule - advance cannot exceed total salary
      expect(savedRecord.advanceAmountPaid).toBeLessThanOrEqual(savedRecord.totalMonthlySalary);

      // Property: Business rule - remaining salary calculation
      const expectedRemaining = savedRecord.totalMonthlySalary - savedRecord.advanceAmountPaid;
      expect(savedRecord.remainingSalaryPayable).toBe(expectedRemaining);

      // Property: Business rule - payment status logic
      if (savedRecord.remainingSalaryPayable === 0) {
        expect(savedRecord.paymentStatus).toBe('Paid');
      } else if (savedRecord.advanceAmountPaid > 0 && savedRecord.remainingSalaryPayable > 0) {
        expect(savedRecord.paymentStatus).toBe('Partially Paid');
      } else if (savedRecord.advanceAmountPaid === 0) {
        expect(savedRecord.paymentStatus).toBe('Pending');
      }

      // Property: All monetary values should be non-negative
      expect(savedRecord.totalMonthlySalary).toBeGreaterThanOrEqual(0);
      expect(savedRecord.advanceAmountPaid).toBeGreaterThanOrEqual(0);
      expect(savedRecord.remainingSalaryPayable).toBeGreaterThanOrEqual(0);

      // Clean up after test
      await SalaryRecord.deleteMany({ employeeId: recordData.employeeId });
    }), { numRuns: 15 });
  });
});