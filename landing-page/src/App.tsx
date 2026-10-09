import { useRef, useState } from "react";
import Acessibilidade from "./components/Acessibilidade/Acessibilidade";
import ComoFunciona from "./components/ComoFunciona/ComoFunciona";
import CtaFinal from "./components/CtaFinal/CtaFinal";
import Desafio from "./components/Desafio/Desafio";
import Faq from "./components/Faq/Faq";
import Footer from "./components/Footer/Footer";
import Header from "./components/Header/Header";
import Hero from "./components/Hero/Hero";
import Publicos from "./components/Publicos/Publicos";
import Seguranca from "./components/Seguranca/Seguranca";
import Solucao from "./components/Solucao/Solucao";
import Contato from "./components/Contato/Contato";

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // com movimento reduzido, o vídeo começa pausado
  const [isPlaying, setIsPlaying] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) void video.play();
    else video.pause();
  };

  return (
    <>
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <Header />

      <main className="home" id="conteudo">
        <div className="visual-stage">
          <video
            ref={videoRef}
            className="visual-stage-video"
            autoPlay={isPlaying}
            muted
            loop
            playsInline
            aria-hidden="true"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src="https://www.pexels.com/download/video/7088510/" type="video/mp4" />
          </video>
          <div className="visual-stage-overlay" aria-hidden="true"></div>
          <button
            className="video-toggle"
            type="button"
            onClick={toggleVideo}
            aria-label={isPlaying ? "Pausar vídeo de fundo" : "Reproduzir vídeo de fundo"}
          >
            <i className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"}`} aria-hidden="true"></i>
          </button>
          <Hero />
          <Desafio />
        </div>

        {/* narrativa: problema → solução → como funciona → para quem → acessibilidade/segurança → tecnologia → CTA */}
        <Solucao />
        <ComoFunciona />
        <Publicos />
        <Acessibilidade />
        <Seguranca />
        <Contato />
        <CtaFinal />
        <Faq />
      </main>

      <Footer />
    </>
  );
}

export default App;
