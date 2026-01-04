const mongoose = require('mongoose');
const { calculateRemainingSalary, determinePaymentStatus } = require('../utils/salaryCalculations');

/**
 * Salary Record Schema for MongoDB
 * Stores employee salary information including advance payments and calculated fields
 */
const salaryRecordSchema = new mongoose.Schema({
  // Employee identification
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    trim: true,
    minlength: [1, 'Employee ID cannot be empty'],
    maxlength: [50, 'Employee ID cannot exceed 50 characters']
  },
  
  employeeName: {
    type: String,
    required: [true, 'Employee name is required'],
    trim: true,
    minlength: [1, 'Employee name cannot be empty'],
    maxlength: [100, 'Employee name cannot exceed 100 characters']
  },
  
  // Time period for salary
  month: {
    type: String,
    required: [true, 'Month is required'],
    enum: {
      values: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ],
      message: 'Month must be a valid month name'
    }
  },
  
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2000, 'Year must be 2000 or later'],
    max: [2100, 'Year must be 2100 or earlier'],
    validate: {
      validator: function(value) {
        return Number.isInteger(value);
      },
      message: 'Year must be a valid integer'
    }
  },
  
  // Salary amounts (stored as numbers for precision)
  totalMonthlySalary: {
    type: Number,
    required: [true, 'Total monthly salary is required'],
    min: [0, 'Total monthly salary must be non-negative'],
    validate: {
      validator: function(value) {
        // Ensure reasonable precision for monetary values (2 decimal places)
        return Number.isFinite(value) && Math.round(value * 100) === value * 100;
      },
      message: 'Total monthly salary must be a valid monetary amount with up to 2 decimal places'
    }
  },
  
  advanceAmountPaid: {
    type: Number,
    required: [true, 'Advance amount paid is required'],
    min: [0, 'Advance amount paid must be non-negative'],
    validate: [
      {
        validator: function(value) {
          // Ensure reasonable precision for monetary values (2 decimal places)
          return Number.isFinite(value) && Math.round(value * 100) === value * 100;
        },
        message: 'Advance amount paid must be a valid monetary amount with up to 2 decimal places'
      },
      {
        validator: function(value) {
          // Advance amount cannot exceed total salary
          return value <= this.totalMonthlySalary;
        },
        message: 'Advance amount paid cannot exceed total monthly salary'
      }
    ]
  },
  
  remainingSalaryPayable: {
    type: Number,
    required: [true, 'Remaining salary payable is required'],
    min: [0, 'Remaining salary payable must be non-negative'],
    validate: {
      validator: function(value) {
        // Ensure reasonable precision for monetary values (2 decimal places)
        return Number.isFinite(value) && Math.round(value * 100) === value * 100;
      },
      message: 'Remaining salary payable must be a valid monetary amount with up to 2 decimal places'
    }
  },
  
  // Payment information
  paymentDate: {
    type: Date,
    required: [true, 'Payment date is required'],
    validate: {
      validator: function(value) {
        // Payment date should not be in the far future (reasonable business rule)
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        return value <= oneYearFromNow;
      },
      message: 'Payment date cannot be more than one year in the future'
    }
  },
  
  paymentStatus: {
    type: String,
    required: [true, 'Payment status is required'],
    enum: {
      values: ['Pending', 'Partially Paid', 'Paid'],
      message: 'Payment status must be one of: Pending, Partially Paid, Paid'
    },
    default: 'Pending'
  }
}, {
  // Automatic timestamps
  timestamps: true,
  
  // JSON transformation options
  toJSON: {
    transform: function(doc, ret) {
      // Convert _id to id for frontend compatibility
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  
  // Object transformation options
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound index for efficient queries by employee and time period
salaryRecordSchema.index({ employeeId: 1, year: 1, month: 1 }, { unique: true });

// Index for payment status queries
salaryRecordSchema.index({ paymentStatus: 1 });

// Index for payment date queries
salaryRecordSchema.index({ paymentDate: 1 });

/**
 * Pre-save middleware to automatically calculate remaining salary and payment status
 */
salaryRecordSchema.pre('save', function(next) {
  this.calculateDerivedFields();
  next();
});

/**
 * Method to calculate derived fields (remaining salary and payment status)
 */
salaryRecordSchema.methods.calculateDerivedFields = function() {
  // Use utility functions for calculations
  this.remainingSalaryPayable = calculateRemainingSalary(this.totalMonthlySalary, this.advanceAmountPaid);
  this.paymentStatus = determinePaymentStatus(this.totalMonthlySalary, this.advanceAmountPaid);
};

// Calculate fields immediately when document is created
salaryRecordSchema.post('init', function() {
  if (this.totalMonthlySalary !== undefined && this.advanceAmountPaid !== undefined) {
    this.calculateDerivedFields();
  }
});

/**
 * Static method to find salary records by employee ID
 */
salaryRecordSchema.statics.findByEmployeeId = function(employeeId) {
  return this.find({ employeeId }).sort({ year: -1, month: -1 });
};

/**
 * Static method to find salary records by payment status
 */
salaryRecordSchema.statics.findByPaymentStatus = function(status) {
  return this.find({ paymentStatus: status }).sort({ paymentDate: -1 });
};

/**
 * Static method to find salary records by month and year
 */
salaryRecordSchema.statics.findByPeriod = function(month, year) {
  return this.find({ month, year }).sort({ employeeName: 1 });
};

/**
 * Instance method to update advance payment
 */
salaryRecordSchema.methods.updateAdvancePayment = function(newAdvanceAmount) {
  if (newAdvanceAmount < 0) {
    throw new Error('Advance amount cannot be negative');
  }
  if (newAdvanceAmount > this.totalMonthlySalary) {
    throw new Error('Advance amount cannot exceed total salary');
  }
  
  this.advanceAmountPaid = newAdvanceAmount;
  // The pre-save middleware will automatically recalculate remaining salary and status
  return this.save();
};

/**
 * Virtual property to get formatted payment date
 */
salaryRecordSchema.virtual('formattedPaymentDate').get(function() {
  return this.paymentDate.toLocaleDateString();
});

/**
 * Virtual property to get formatted salary amounts
 */
salaryRecordSchema.virtual('formattedAmounts').get(function() {
  return {
    totalSalary: `$${this.totalMonthlySalary.toFixed(2)}`,
    advancePaid: `$${this.advanceAmountPaid.toFixed(2)}`,
    remainingPayable: `$${this.remainingSalaryPayable.toFixed(2)}`
  };
});

// Ensure virtual fields are serialized
salaryRecordSchema.set('toJSON', { virtuals: true });
salaryRecordSchema.set('toObject', { virtuals: true });

const SalaryRecord = mongoose.model('SalaryRecord', salaryRecordSchema);

module.exports = SalaryRecord;