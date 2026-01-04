/**
 * Main App Component
 * 
 * Entry point for the Salary Tracker Management System React application.
 */

import React from 'react';
import SalaryTracker from './components/SalaryTracker';
import './App.css';

function App() {
  return (
    <div className="App">
      <SalaryTracker />
    </div>
  );
}

export default App;