import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  );
}

export default App;
