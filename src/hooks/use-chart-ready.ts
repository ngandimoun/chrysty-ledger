"use client";

import { useEffect, useState } from "react";

export function useChartReady(deps: unknown[]) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);
    const frame = requestAnimationFrame(() => {
      setIsReady(true);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies reactive deps
  }, deps);

  return isReady;
}
