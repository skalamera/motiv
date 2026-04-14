export type Shop = {
  rank: number;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  distance: number;
  googleRating: number | null;
  googleReviews: number | null;
  yelpRating: number | null;
  yelpReviews: number | null;
  baseScore: number;
  confidenceWeight: number;
  finalScore: number;
  technicalCompetency: string;
  sentimentSummary: string;
  rankingAnalysis: string;
  bestFor: string;
  commuteDifficulty: string;
  specialistCapability: string;
  lat: number;
  lng: number;
};

export type ShopSearchResult = {
  shops: Shop[];
  car: string;
  userAddress: string;
};
