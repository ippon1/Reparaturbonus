export interface ShopRecord {
  name: string;
  address?: string;
  website?: string;

  offersRepair?: boolean | null;

  firstPriceDate?: string | null;
  firstPrice?: number | null;
  firstPriceInflationAdjusted?: number | null;
  firstPriceSource?: string | null;

  currentPriceDate?: string | null;
  currentPrice?: number | null;
  currentPriceSource?: string | null;

  lat?: number | null;
  lon?: number | null;

  // derived
  deltaVsFirstAdj?: number | null; // currentPrice - firstPriceInflationAdjusted
  deltaVsFirstAdjPercentage?: number | null; // (currentPrice - firstPriceInflationAdjusted)/currentPrice
}

export interface SelectionSettings {
  q: string;
  onlyWithCurrent: boolean;

  // OffersRepair header checkboxes
  offersRepairYes: boolean;
  offersRepairNo: boolean;

  // Price range filters
  firstPriceMin: number | null;
  firstPriceMax: number | null;
  currentPriceMin: number | null;
  currentPriceMax: number | null;

  // Presence filters
  hasFirstPrice: boolean;
  missingFirstPrice: boolean;
  hasFirstAdj: boolean;
  missingFirstAdj: boolean;
  hasCurrentPrice: boolean;
  missingCurrentPrice: boolean;

  // Date range filters (ISO yyyy-MM-dd strings)
  firstDateFrom: string | null;
  firstDateTo: string | null;
  currentDateFrom: string | null;
  currentDateTo: string | null;
}


export const defaultSelectionSettings: SelectionSettings = {
  q: '',
  onlyWithCurrent: false,

  // OffersRepair header checkboxes
  offersRepairYes: true,
  offersRepairNo: false,

  // Price range filters
  firstPriceMin: null,
  firstPriceMax: null,
  currentPriceMin: null,
  currentPriceMax: null,

  // Presence filters
  hasFirstPrice: true,
  missingFirstPrice: false,
  hasFirstAdj: true,
  missingFirstAdj: false,
  hasCurrentPrice: true,
  missingCurrentPrice: false,

  // Date range filters
  firstDateFrom: '1970-01-01',
  firstDateTo: '2022-01-01',
  currentDateFrom: '2023-01-01',
  currentDateTo: new Date().toISOString().substring(0, 10),
};
