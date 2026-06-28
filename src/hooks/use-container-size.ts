"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ContainerSize = {
  width: number;
  height: number;
};

function readSize(element: HTMLElement | null): ContainerSize {
  if (!element) return { width: 0, height: 0 };
  const rect = element.getBoundingClientRect();
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function useContainerSize() {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });
  const [isMeasured, setIsMeasured] = useState(false);
  const [remountKey, setRemountKey] = useState(0);
  const rafRef = useRef<number | null>(null);

  const applySize = useCallback((next: ContainerSize) => {
    setSize(next);
    setIsMeasured(next.width > 0);
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        applySize(readSize(elementRef.current));
      });
    });
  }, [applySize]);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      elementRef.current = node;
      if (node) {
        scheduleMeasure();
      } else {
        applySize({ width: 0, height: 0 });
      }
    },
    [applySize, scheduleMeasure]
  );

  useEffect(() => {
    const node = elementRef.current;
    if (!node) return;

    scheduleMeasure();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      scheduleMeasure();
    }) : null;

    observer?.observe(node);

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", scheduleMeasure);
    window.addEventListener("resize", scheduleMeasure);

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setRemountKey((current) => current + 1);
        scheduleMeasure();
      }
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      observer?.disconnect();
      viewport?.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [scheduleMeasure]);

  return { ref, width: size.width, height: size.height, isMeasured, remountKey };
}
