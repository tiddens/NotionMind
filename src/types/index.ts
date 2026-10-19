export interface MindMapNode {
  id: string;
  text: string;
  children: MindMapNode[];
  collapsed: boolean;
  side?: 'left' | 'right'; // Only used for direct children of root
  imageUrl?: string; // relative path to stored image
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  side: 'left' | 'right';
  depth: number;
  branchIndex: number;
  hasImage: boolean; // whether node has an image (affects edge connection point)
  textLines: string[];
  textHeight: number;
  imageWidth?: number;
  imageHeight?: number;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'folder';
  children?: FileEntry[];
}
