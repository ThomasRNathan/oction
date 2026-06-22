export type CalisthenicsSpot = {
  id: number;
  name: string | null;
  title: string;
  latitude: number;
  longitude: number;
  address: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  url: string;
};

export type CalisthenicsSpotDetail = {
  id: number;
  rating: number | null;
  ratingMax: number;
  disciplines: string[];
  equipment: string[];
  tags: string[];
  images: string[];
  illuminated: boolean;
  roofed: boolean;
  accessible: boolean;
  commentCount: number;
  scrapedAt: string;
};

export type CalisthenicsSpotEnriched = CalisthenicsSpot & {
  detail?: CalisthenicsSpotDetail;
};

export type CalisthenicsMapMeta = {
  total: number;
  withDetails: number;
  countries: string[];
};

export type CalisthenicsMapResponse = {
  spots: CalisthenicsSpotEnriched[];
  meta: CalisthenicsMapMeta;
};
