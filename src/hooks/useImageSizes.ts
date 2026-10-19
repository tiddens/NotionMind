import { useEffect, useRef, useState } from 'react';
import type { ImageDimensions } from '../types';

// Image dimensions affect layout only; opening a map never rewrites its files.
export function useImageSizes(filenames: string[]): ReadonlyMap<string, ImageDimensions> {
  const [sizes, setSizes] = useState(new Map<string, ImageDimensions>());
  const measured = useRef(new Set<string>());

  useEffect(() => {
    const images = filenames.filter(filename => !measured.current.has(filename)).map(filename => {
      const image = new Image();
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        measured.current.add(filename);
        setSizes(previous => new Map(previous).set(filename, { width: image.naturalWidth, height: image.naturalHeight }));
      };
      image.src = `/api/images/${encodeURIComponent(filename)}`;
      return image;
    });
    return () => { for (const image of images) image.onload = null; };
  }, [filenames]);

  return sizes;
}
