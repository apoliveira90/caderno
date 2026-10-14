// Everything in a workspace is a block: pages, paragraphs, databases and
// database rows. A block knows its parent and the ordered ids of its children.

export type ID = string;

export type BlockType =
  | 'page'
  | 'database'
  | 'linked_db'
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'todo'
  | 'bullet'
  | 'numbered'
  | 'toggle'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider';

export type Color = 'default' | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red';

export type PropertyType =
  | 'title'
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'status'
  | 'person'
  | 'date'
  | 'checkbox'
  | 'url';

export type StatusGroup = 'todo' | 'doing' | 'done';

export interface Option {
  id: ID;
  name: string;
  color: Color;
  group?: StatusGroup;
}

export interface Property {
  id: ID;
  name: string;
  type: PropertyType;
  options?: Option[];
}

/** select/status: option id; multi_select/person: option ids; date: YYYY-MM-DD. */
export type PropValue = string | number | boolean | string[] | null;

export type FilterOp = 'is' | 'is_not' | 'contains' | 'not_contains' | 'empty' | 'not_empty' | 'checked' | 'unchecked';

export interface Filter {
  id: ID;
  propId: ID;
  op: FilterOp;
  value?: string;
}

export interface Sort {
  propId: ID;
  dir: 'asc' | 'desc';
}

export interface View {
  id: ID;
  name: string;
  type: 'table' | 'board';
  groupBy?: ID;
  filters: Filter[];
  sorts: Sort[];
  hidden: ID[];
}

export interface Block {
  id: ID;
  type: BlockType;
  parent: ID | null;
  children: ID[];
  /** Plain text for content blocks, the title for pages, databases and rows. */
  text: string;
  icon?: string;
  checked?: boolean;
  collapsed?: boolean;
  /** Database schema (type === 'database'). */
  schema?: Property[];
  /** Views of a database, or of the database a linked view shows. */
  views?: View[];
  /** The database a linked view shows (type === 'linked_db'). */
  source?: ID;
  /** Property values of a database row (a page whose parent is a database). */
  props?: Record<ID, PropValue>;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  version: 1;
  rootIds: ID[];
  blocks: Record<ID, Block>;
}
