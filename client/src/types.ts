export interface EntryTag {
  type: 'size' | 'source';
  value: string;
}

export interface ClothesEntry {
  id: string;
  name: string;
  boughtPrice: number;
  sellPrice: number | null;
  boughtAt?: string | null;
  soldAt: string | null;
  createdAt: string;
  vintedUrl?: string | null;
  tags?: EntryTag[];
}

export interface MonthlyStat {
  month: string;
  boughtTotal: number;
  soldTotal: number;
  soldCount: number;
  addedCount: number;
  profit: number;
}
