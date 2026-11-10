import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/painel.css';
import './styles/ds-bundle.css';
import './styles/app.css';
import './styles/tailwind.css';
import { installBehaviors } from './behaviors/index.js';
import { AuthProvider } from './auth/AuthContext';
import { App } from './App';

installBehaviors();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
