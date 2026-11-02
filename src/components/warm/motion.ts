import { useLayoutEffect, type RefObject } from 'react';

export function motionPolicy(element: Element) {
  const root = element.closest<HTMLElement>('.bfstaff-app');
  return {
    instant: root?.dataset.inputMode === 'keyboard',
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    ease: getComputedStyle(element).getPropertyValue('--bf-motion-ease').trim() || 'cubic-bezier(.16,1,.3,1)'
  };
}

export function useInterfaceViewport(ref: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.dataset.inputMode = 'pointer';
    const pointer = () => { root.dataset.inputMode = 'pointer'; };
    const keyboard = () => { root.dataset.inputMode = 'keyboard'; };
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      root.style.setProperty('--bf-visual-bottom', `${Math.max(0, window.innerHeight - top - height)}px`);
      root.style.setProperty('--bf-visual-height', `${height}px`);
      root.style.setProperty('--bf-visual-width', `${width}px`);
      root.style.setProperty('--bf-visual-center', `${(viewport?.offsetLeft ?? 0) + width / 2}px`);
    };
    updateViewport();
    window.addEventListener('pointerdown', pointer, true);
    window.addEventListener('keydown', keyboard, true);
    window.addEventListener('resize', updateViewport);
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    return () => {
      window.removeEventListener('pointerdown', pointer, true);
      window.removeEventListener('keydown', keyboard, true);
      window.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
    };
  }, [ref]);
}
