export interface MindMapNode {
  id: string;
  text: string;
  children: MindMapNode[];
  collapsed: boolean;
  side?: 'left' | 'right'; // Only used for direct children of root
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  side: 'left' | 'right';
  depth: number;
  branchIndex: number; // index of the top-level branch this node belongs to
}

export interface FileEntry {
  name: string;
  type: 'file' | 'folder';
  children?: FileEntry[];
}
