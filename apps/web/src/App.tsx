import { Navigate, Route, Routes } from 'react-router-dom';
import { rotaInicial, useAuth } from './auth/AuthContext';
import { ExigeSituacao, SO_DEFERIDO, SO_PENDENCIA_I, SO_PENDENCIA_II, SoVisitante } from './auth/guards';
import { AppLayout } from './components/Layout';
import { Login } from './pages/Login';
import { EsqueciSenha } from './pages/EsqueciSenha';
import { RedefinirSenha } from './pages/RedefinirSenha';
import { PrimeiroAcesso } from './pages/PrimeiroAcesso';
import { PainelBloqueado } from './pages/PainelBloqueado';
import { RevisaoDados } from './pages/RevisaoDados';
import { Atendimentos } from './pages/Atendimentos';
import { NovoAtendimento } from './pages/NovoAtendimento';
import { DetalhesAtendimento } from './pages/DetalhesAtendimento';
import { AlterarAtendimento } from './pages/AlterarAtendimento';
import { AvaliarFormulario } from './pages/AvaliarFormulario';
import { Formularios } from './pages/Formularios';
import { FormularioEditor } from './pages/FormularioEditor';
import { VisualizarFormulario } from './pages/VisualizarFormulario';
import { Perfil } from './pages/Perfil';
import { Usuarios } from './pages/Usuarios';
import { UsuarioDetalhe } from './pages/UsuarioDetalhe';
import { CadastrarProfissional } from './pages/CadastrarProfissional';

function Inicio() {
  const { usuario, carregando } = useAuth();
  if (carregando) return null;
  return <Navigate to={rotaInicial(usuario)} replace />;
}

export function App() {
  return (
    <Routes>
      {/* Sem login */}
      <Route element={<SoVisitante />}>
        <Route path="/login" element={<Login />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      </Route>
      {/* O link do e-mail funciona com ou sem sessão aberta */}
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />

      {/* Pendência I: só a troca da senha provisória (RN-USR-08) */}
      <Route element={<ExigeSituacao situacoes={SO_PENDENCIA_I} />}>
        <Route path="/primeiro-acesso" element={<PrimeiroAcesso />} />
      </Route>

      {/* Pendência II: só revisar e confirmar os dados (RN-USR-09) */}
      <Route element={<ExigeSituacao situacoes={SO_PENDENCIA_II} />}>
        <Route element={<AppLayout />}>
          <Route path="/inicio" element={<PainelBloqueado />} />
          <Route path="/revisao" element={<RevisaoDados />} />
        </Route>
      </Route>

      {/* Deferido */}
      <Route element={<ExigeSituacao situacoes={SO_DEFERIDO} />}>
        <Route element={<AppLayout />}>
          <Route path="/atendimentos" element={<Atendimentos />} />
          <Route path="/atendimentos/novo" element={<NovoAtendimento />} />
          <Route path="/atendimentos/:id" element={<DetalhesAtendimento />} />
          <Route path="/atendimentos/:id/alterar" element={<AlterarAtendimento />} />
          <Route path="/atendimentos/:id/formularios/:idFormulario" element={<AvaliarFormulario />} />
          <Route path="/formularios" element={<Formularios />} />
          <Route path="/formularios/novo" element={<FormularioEditor />} />
          <Route path="/formularios/:id" element={<VisualizarFormulario />} />
          <Route path="/formularios/:id/editar" element={<FormularioEditor />} />
          <Route path="/perfil" element={<Perfil />} />
        </Route>
      </Route>

      {/* Gestão de usuários: só o máximo */}
      <Route element={<ExigeSituacao situacoes={SO_DEFERIDO} soMaximo />}>
        <Route element={<AppLayout />}>
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/usuarios/novo" element={<CadastrarProfissional />} />
          <Route path="/usuarios/:id" element={<UsuarioDetalhe />} />
        </Route>
      </Route>

      <Route path="*" element={<Inicio />} />
    </Routes>
  );
}
