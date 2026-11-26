import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  CadastroPaciente: undefined;
  EsqueceuSenha: undefined;
};

export type PacienteStackParamList = {
  MeusAtendimentos: undefined;
  FormulariosAtendimento: { idAtendimento: number; descricao: string };
  ResponderFormulario: {
    idAtendimento: number;
    idFormulario: number;
    nomeFormulario: string;
  };
  Perfil: undefined;
  Notificacoes: undefined;
  Assistente: undefined;
};

export type AuthNavProp = NativeStackNavigationProp<AuthStackParamList>;
export type PacienteNavProp = NativeStackNavigationProp<PacienteStackParamList>;

// Alias de compatibilidade para as telas de auth já existentes
export type NavigationProp = AuthNavProp;
