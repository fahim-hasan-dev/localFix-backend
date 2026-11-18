export type TAnalyticsPeriod = "this_month" | "this_year" | "all_time";

export type TAnalyticsStats = {
  earnings: number;
  earningsFormatted: string;
  earningsGrowth: number;
  earningsGrowthFormatted: string;
  completedJobs: number;
  clients: number;
  rating: number;
  totalReviews: number;
  ratingDetails?: {
    averageRating: number;
    totalReviews: number;
    periodRating: number;
    periodReviews: number;
    overallRating: number;
    overallReviews: number;
  };
};

export type TMonthlyIncomeItem = {
  month: string;
  monthNumber: number;
  year: number;
  income: number;
  formattedIncome: string;
  isSelected?: boolean;
};

export type TClientAndWorkVolumeItem = {
  month: string;
  monthNumber: number;
  year: number;
  clients: number;
  jobs: number;
  volume: number;
  formatted: string;
  isSelected?: boolean;
};

export type TDailyIncomeItem = {
  day: number;
  date: string;
  income: number;
  formattedIncome: string;
  jobs: number;
  clients: number;
};

export type THistoryClient = {
  _id?: string;
  name: string;
  profileImage?: string;
  email?: string;
  phone?: string;
};

export type THistoryItem = {
  _id: string;
  bookingId: string;
  client: THistoryClient;
  clientName: string;
  clientImage: string;
  serviceTitle: string;
  category: string;
  date: Date | string;
  formattedDate: string;
  amount: number;
  formattedAmount: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
};

export type TProfessionalHistoryResponse = {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
  data: THistoryItem[];
};

export type TProfessionalAnalyticsResponse = {
  period: TAnalyticsPeriod;
  periodLabel: string;
  year: number;
  selectedMonth?: number;
  stats: TAnalyticsStats;
  monthlyIncomeOverview: TMonthlyIncomeItem[];
  clientsAndWorkVolume: TClientAndWorkVolumeItem[];
  clientAndWorkVolume: TClientAndWorkVolumeItem[];
  dailyIncomeOverview?: TDailyIncomeItem[];
};

export type TProfessionalApplicationResponse = {
  approvalStatus: string;
  rejectionReason?: string | null;
  backgroundCheck: {
    status: string;
    statusLabel: string;
    isCleared: boolean;
    provider: string;
    providerDescription: string;
    checkrInvitationUrl?: string | null;
    viewUrl?: string | null;
    passed?: boolean;
    verifiedAt?: Date | string | null;
    notes?: string | null;
  };
  tradeLicense: {
    licenseNumber: string;
    state: string;
    issuingState: string;
    status: string;
    isVerified: boolean;
    certificateUrl?: string | null;
    fileName?: string | null;
  };
  liabilityInsurance: {
    carrier: string;
    coverage: string;
    coverageLimit: string;
    status: string;
    isVerified: boolean;
    expires?: string | null;
    certificateUrl?: string | null;
    fileName?: string | null;
  };
};

