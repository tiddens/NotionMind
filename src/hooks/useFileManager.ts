import { useState, useCallback } from 'react';
import type { FileEntry } from '../types';

export function useFileManager() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  const loadFileList = useCallback(async (): Promise<FileEntry[]> => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data: FileEntry[] = await res.json();
        setFiles(data);
        return data;
      }
    } catch {
      // Server may not be running
    }
    return [];
  }, []);

  const openFile = useCallback(async (name: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(name)}`);
      if (res.ok) {
        const text = await res.text();
        setCurrentFile(name);
        return text;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const saveFile = useCallback(async (name: string, content: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: content,
      });
      if (res.ok) {
        setCurrentFile(name);
        await loadFileList();
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [loadFileList]);

  const createFile = useCallback(async (name: string): Promise<boolean> => {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    return saveFile(fileName, '# Untitled\n');
  }, [saveFile]);

  const deleteFile = useCallback(async (name: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (currentFile === name) setCurrentFile(null);
        await loadFileList();
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [currentFile, loadFileList]);

  const renameFile = useCallback(async (oldName: string, newName: string): Promise<boolean> => {
    const fileName = newName.endsWith('.md') ? newName : `${newName}.md`;
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: fileName }),
      });
      if (res.ok) {
        if (currentFile === oldName) setCurrentFile(fileName);
        await loadFileList();
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [currentFile, loadFileList]);

  const createFolder = useCallback(async (name: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: name }),
      });
      if (res.ok) {
        await loadFileList();
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [loadFileList]);

  const saveMeta = useCallback(async (name: string, meta: Record<string, unknown>): Promise<void> => {
    const metaName = name + '.meta.json';
    try {
      await fetch(`/api/files/${encodeURIComponent(metaName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(meta),
      });
    } catch { /* ignore */ }
  }, []);

  const loadMeta = useCallback(async (name: string): Promise<Record<string, unknown> | null> => {
    const metaName = name + '.meta.json';
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(metaName)}`);
      if (res.ok) {
        const text = await res.text();
        return JSON.parse(text);
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const uploadImage = useCallback(async (blob: Blob): Promise<string | null> => {
    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: blob,
      });
      if (res.ok) {
        const data = await res.json();
        return data.filename;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  return {
    files,
    currentFile,
    setCurrentFile,
    loadFileList,
    openFile,
    saveFile,
    createFile,
    deleteFile,
    renameFile,
    createFolder,
    saveMeta,
    loadMeta,
    uploadImage,
  };
}
