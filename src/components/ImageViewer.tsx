import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ImageViewer.css';

interface Props {
  filename: string;
  title: string;
  onClose: () => void;
}

interface View {
  zoom: number;
  x: number;
  y: number;
}

const FIT: View = { zoom: 1, x: 0, y: 0 };
const MAX_ZOOM = 8;

export function ImageViewer({ filename, title, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [view, setView] = useState<View>(FIT);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');

  // Keep a zoomed image within reach, including after resizing the viewport.
  const clampView = useCallback((next: View): View => {
    const stage = stageRef.current;
    const image = imageRef.current;
    const zoom = Math.max(1, Math.min(MAX_ZOOM, next.zoom));
    if (!stage || !image || zoom === 1) return { zoom, x: 0, y: 0 };
    const maxX = Math.max(0, (image.offsetWidth * zoom - stage.clientWidth + 48) / 2);
    const maxY = Math.max(0, (image.offsetHeight * zoom - stage.clientHeight + 48) / 2);
    return {
      zoom,
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }, []);

  const zoomBy = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = clientX === undefined ? 0 : clientX - rect.left - rect.width / 2;
    const y = clientY === undefined ? 0 : clientY - rect.top - rect.height / 2;
    setView(previous => {
      const zoom = Math.max(1, Math.min(MAX_ZOOM, previous.zoom * factor));
      const ratio = zoom / previous.zoom;
      return clampView({ zoom, x: x - (x - previous.x) * ratio, y: y - (y - previous.y) * ratio });
    });
  }, [clampView]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const surface = surfaceRef.current;
    dialog.showModal();
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === surface);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (document.fullscreenElement === surface) void document.exitFullscreen().catch(() => {});
      dialog.close();
      if (trigger instanceof HTMLElement || trigger instanceof SVGElement) trigger.focus();
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // A non-passive listener prevents browser/page zoom from competing with image zoom.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!loaded || failed) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
      zoomBy(Math.exp(Math.max(-1, Math.min(1, -delta * 0.002))), event.clientX, event.clientY);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    const observer = new ResizeObserver(() => setView(previous => clampView(previous)));
    observer.observe(stage);
    return () => {
      stage.removeEventListener('wheel', onWheel);
      observer.disconnect();
    };
  }, [clampView, failed, loaded, zoomBy]);

  const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(pointers.current.size > 0);
  };

  const toggleFullscreen = async () => {
    setFullscreenError('');
    try {
      if (document.fullscreenElement === surfaceRef.current) await document.exitFullscreen();
      else await surfaceRef.current?.requestFullscreen();
    } catch {
      setFullscreenError('Full screen is unavailable. You can still zoom in this viewer.');
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="image-viewer"
      aria-label="Image viewer"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
        if (event.key === 'Tab') {
          const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const index = controls.indexOf(document.activeElement as HTMLButtonElement);
          const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
          event.preventDefault();
          controls[next]?.focus();
          return;
        }
        if (!loaded || failed || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.25); }
        else if (event.key === '-') { event.preventDefault(); zoomBy(1 / 1.25); }
        else if (event.key === '0') { event.preventDefault(); setView(FIT); }
        else if (event.key.startsWith('Arrow')) {
          event.preventDefault();
          setView(previous => clampView({
            ...previous,
            x: previous.x + (event.key === 'ArrowLeft' ? 60 : event.key === 'ArrowRight' ? -60 : 0),
            y: previous.y + (event.key === 'ArrowUp' ? 60 : event.key === 'ArrowDown' ? -60 : 0),
          }));
        }
      }}
    >
      <div ref={surfaceRef} className="image-viewer__surface">
      <header className="image-viewer__toolbar">
        <h2 title={title}>{title || 'Image'}</h2>
        <div className="image-viewer__controls" role="group" aria-label="Image controls">
          <button type="button" aria-label="Zoom out" title="Zoom out (-)" disabled={!loaded || failed || view.zoom === 1} onClick={() => zoomBy(1 / 1.25)}>−</button>
          <output aria-label="Zoom level" aria-live="polite">{Math.round(view.zoom * 100)}%</output>
          <button type="button" aria-label="Zoom in" title="Zoom in (+)" disabled={!loaded || failed || view.zoom === MAX_ZOOM} onClick={() => zoomBy(1.25)}>+</button>
          <button type="button" aria-label="Fit to screen" title="Fit to screen (0)" disabled={!loaded || failed} onClick={() => setView(FIT)}>Fit</button>
          {document.fullscreenEnabled && (
            <button type="button" className="image-viewer__fullscreen" aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'} onClick={toggleFullscreen}>
              {fullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
          )}
          <button type="button" className="image-viewer__close" aria-label="Close image viewer" title="Close (Esc)" autoFocus onClick={onClose}>Close <span aria-hidden="true">×</span></button>
        </div>
      </header>
      <div
        ref={stageRef}
        className={`image-viewer__stage${view.zoom > 1 ? ' image-viewer__stage--zoomed' : ''}${dragging ? ' image-viewer__stage--dragging' : ''}`}
        onPointerDown={event => {
          if (event.button !== 0 || !loaded || failed) return;
          event.preventDefault();
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={event => {
          const previous = pointers.current.get(event.pointerId);
          if (!previous) return;
          const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (other) {
            const before = Math.hypot(previous.x - other.x, previous.y - other.y);
            const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
            if (before > 0) zoomBy(after / before, (event.clientX + other.x) / 2, (event.clientY + other.y) / 2);
          } else {
            setView(current => clampView({ ...current, x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y }));
          }
        }}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onLostPointerCapture={releasePointer}
        onDoubleClick={event => { event.preventDefault(); if (loaded && !failed) { if (view.zoom > 1) setView(FIT); else zoomBy(2, event.clientX, event.clientY); } }}
      >
        {!loaded && !failed && <p role="status" className="image-viewer__message">Loading image…</p>}
        {failed && <p role="alert" className="image-viewer__message">This image could not be loaded.</p>}
        <img
          ref={imageRef}
          src={`/api/images/${encodeURIComponent(filename)}`}
          alt={title || 'Image'}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{ visibility: loaded && !failed ? 'visible' : 'hidden', transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        />
      </div>
      <footer className="image-viewer__hint">
        {fullscreenError || 'Scroll or pinch to zoom · Drag to move · Double-click to zoom or fit · Esc to close'}
      </footer>
      </div>
    </dialog>,
    document.body,
  );
}
