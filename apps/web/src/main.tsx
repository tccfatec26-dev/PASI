import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/painel.css';
import './styles/ds-bundle.css';
import './styles/app.css';
import './styles/dark.css';
import './styles/ajustes.css';
import './styles/responsivo.css';
import './styles/acessibilidade.css';
import './styles/tailwind.css';
import { installBehaviors } from './behaviors/index.js';
import { iniciarTema } from './lib/tema';
import { iniciarAcessibilidade } from './lib/acessibilidade';
import { AuthProvider } from './auth/AuthContext';
import { AvisosProvider } from './components/Avisos';
import { MenuAcessibilidade } from './components/Acessibilidade';
import { App } from './App';

iniciarTema();
iniciarAcessibilidade();
installBehaviors();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AvisosProvider>
          <App />
          <MenuAcessibilidade />
        </AvisosProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
