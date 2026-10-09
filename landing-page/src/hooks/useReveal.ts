import { useEffect, useRef } from "react";

/**
 * Adiciona `visibleClass` ao elemento quando ele entra na tela (uma vez só).
 * Com movimento reduzido, o CSS já mostra o conteúdo sem animação.
 */
export function useReveal<T extends HTMLElement>(visibleClass = "is-visible", threshold = 0.15) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      element.classList.add(visibleClass);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            element.classList.add(visibleClass);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [visibleClass, threshold]);

  return ref;
}
