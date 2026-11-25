const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem: false deixa o rem dinâmico: o "tamanho do texto" do menu de
// acessibilidade muda o rem em tempo de execução (src/acessibilidade/preferencias.ts).
module.exports = withNativeWind(config, { input: './global.css', inlineRem: false });
