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
import { AvisosProvider } from './components/Avisos';
import { App } from './App';

installBehaviors();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AvisosProvider>
          <App />
        </AvisosProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
