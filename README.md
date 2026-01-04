# Salary Tracker Management System

A comprehensive MERN stack application for tracking employee salaries, advance payments, and payment status management with real-time calculations and comprehensive testing.

## Features

- **Employee Salary Management**: Track monthly salaries for all employees
- **Advance Payment Processing**: Handle partial or full salary advances with validation
- **Automatic Calculations**: Real-time calculation of remaining salary amounts
- **Payment Status Tracking**: Automatic status updates (Pending, Partially Paid, Paid)
- **Data Persistence**: MongoDB storage with Mongoose ODM and validation
- **Real-time UI**: React frontend with immediate state updates and form validation
- **Comprehensive Testing**: Property-based testing with fast-check and integration tests
- **API Validation**: Complete input validation and error handling

## Technology Stack

- **Frontend**: React.js with functional components and hooks
- **Backend**: Node.js with Express.js framework
- **Database**: MongoDB with Mongoose ODM
- **Testing**: Jest with fast-check for property-based testing
- **Validation**: Comprehensive input validation and business rule enforcement

## Project Structure

```
salary-tracker-system/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── SalaryTracker.js
│   │   │   ├── SalaryTracker.css
│   │   │   └── SalaryTracker.test.js
│   │   ├── services/       # API services
│   │   └── tests/          # Frontend tests
│   └── package.json
├── server/                 # Express backend
│   ├── models/             # Mongoose models
│   │   └── SalaryRecord.js
│   ├── routes/             # API routes
│   │   └── salary.js
│   ├── utils/              # Business logic utilities
│   │   └── salaryCalculations.js
│   ├── tests/              # Backend tests
│   │   ├── models/         # Model tests
│   │   ├── routes/         # Route tests
│   │   ├── utils/          # Utility tests
│   │   └── integration/    # Integration tests
│   └── package.json
├── .kiro/                  # Kiro specifications
│   └── specs/
│       └── salary-tracker-system/
├── .env                    # Environment variables
└── package.json           # Root package.json
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB connection string
   ```

4. Start the development servers:
   ```bash
   # Start both client and server
   npm run dev
   
   # Or start individually:
   # Backend server (port 5000)
   cd server && npm start
   
   # Frontend client (port 3000)
   cd client && npm start
   ```

### Testing

Run all tests:
```bash
npm test
```

Run server tests only:
```bash
cd server && npm test
```

Run client tests only:
```bash
cd client && npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## API Endpoints

### POST /api/addSalary
Create a new salary record with automatic calculations.

**Request Body:**
```json
{
  "employeeId": "EMP001",
  "employeeName": "John Doe",
  "month": 10,
  "year": 2023,
  "totalMonthlySalary": 50000.00,
  "advanceAmountPaid": 20000.00,
  "paymentDate": "2023-10-15T00:00:00.000Z"
}
```

**Response:**
```json
{
  "message": "Salary record created successfully",
  "data": {
    "id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "employeeId": "EMP001",
    "employeeName": "John Doe",
    "month": "October",
    "year": 2023,
    "totalMonthlySalary": 50000.00,
    "advanceAmountPaid": 20000.00,
    "remainingSalaryPayable": 30000.00,
    "paymentStatus": "Partially Paid",
    "paymentDate": "2023-10-15T00:00:00.000Z",
    "createdAt": "2023-10-15T10:30:00.000Z",
    "updatedAt": "2023-10-15T10:30:00.000Z"
  }
}
```

### GET /api/salaries
Retrieve salary records with optional filtering and pagination.

**Query Parameters:**
- `employeeId` (optional): Filter by employee ID
- `month` (optional): Filter by month name (e.g., "October")
- `year` (optional): Filter by year
- `paymentStatus` (optional): Filter by status ("Pending", "Partially Paid", "Paid")
- `limit` (optional, default: 50): Number of records to return
- `skip` (optional, default: 0): Number of records to skip for pagination

### GET /api/salaries/:id
Retrieve a specific salary record by ID.

### GET /api/employees/:employeeId/salaries
Retrieve all salary records for a specific employee with summary statistics.

## Business Logic

### Salary Calculation
```javascript
remainingSalaryPayable = totalMonthlySalary - advanceAmountPaid
```

### Payment Status Determination
- **Paid**: `remainingSalaryPayable === 0 && totalMonthlySalary > 0`
- **Partially Paid**: `advanceAmountPaid > 0 && remainingSalaryPayable > 0`
- **Pending**: `advanceAmountPaid === 0`

### Validation Rules
- Advance amount cannot exceed total monthly salary
- All monetary values must be non-negative (in Indian Rupees ₹)
- Employee ID and name are required
- Month must be between 1-12
- Year must be valid (2000-2100)
- Payment date must be a valid ISO date

## Testing Strategy

### Property-Based Testing
The system uses fast-check for property-based testing with 100+ iterations per test to ensure correctness across a wide range of inputs:

- **Salary calculation accuracy**: Validates mathematical correctness
- **Payment status determination**: Ensures proper status logic
- **Advance amount validation**: Prevents invalid advance amounts
- **Data persistence round trip**: Verifies database consistency
- **Decimal precision**: Ensures monetary calculations are accurate

### Integration Testing
Comprehensive end-to-end tests verify complete data flow from API to database:

- Complete salary record lifecycle
- Multiple records for same employee
- Business rule validation across all layers
- Concurrent operations and data consistency
- Error handling and recovery
- Filtering and pagination

### Unit Testing
Focused tests for specific functionality:

- Individual utility functions
- React component rendering
- API endpoint validation
- Database model validation

## Development Workflow

This project follows a specification-driven development approach:

1. **Requirements**: Defined in `.kiro/specs/salary-tracker-system/requirements.md`
2. **Design**: Architecture and properties in `.kiro/specs/salary-tracker-system/design.md`
3. **Tasks**: Implementation plan in `.kiro/specs/salary-tracker-system/tasks.md`

All tasks have been completed and validated with comprehensive testing.

## Error Handling

The system includes comprehensive error handling:

- **Client-side**: Form validation and user-friendly error messages
- **API-level**: Input validation with detailed error responses
- **Database-level**: Schema validation and constraint enforcement
- **Business logic**: Rule validation with clear error messages

## Contributing

1. Follow the existing code style and patterns
2. Write tests for all new functionality (including property-based tests)
3. Ensure all tests pass before submitting
4. Update documentation as needed
5. Follow the specification-driven development workflow

## License

MIT License