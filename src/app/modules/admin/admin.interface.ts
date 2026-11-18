export interface IAdminDashboardStats {
  subscriptionRevenue: number;
  formattedSubscriptionRevenue: string;
  totalUsers: number;
  totalHomeowners: number;
  totalVerifiedPros: number;
  activeOrders: number;
  supportTickets: number;
  openSupportTickets: number;
  openQueueTickets: number;
  totalSupportTickets: number;
  monthlyRevenue?: number;
  activeSubscriptions?: number;
}

export interface IMonthlyRevenueItem {
  month: string;
  revenue: number;
  subscriptionRevenue?: number;
  bookingRevenue?: number;
  formattedRevenue?: string;
}

export interface IAdminMonthlyRevenueResponse {
  year: number;
  totalRevenue: number;
  annualTotal: number;
  formattedTotalRevenue: string;
  formattedAnnualTotal: string;
  revenue: IMonthlyRevenueItem[];
}

export interface IUserGrowthItem {
  month: string;
  homeowners: number;
  verifiedPros: number;
  pros: number;
  total: number;
  newHomeowners: number;
  newVerifiedPros: number;
  newPros: number;
  newTotal: number;
}

export interface IAdminUserGrowthResponse {
  year: number;
  totalUsers: number;
  totalHomeowners: number;
  totalVerifiedPros: number;
  growth: IUserGrowthItem[];
}

// ==========================================
// Admin User Management Interfaces
// ==========================================

export interface IAdminUserPortfolio {
  propertiesCount: number;
  unitsCount: number;
  maxUnits: number | null;
  formattedPortfolio: string;
  formattedUnits: string;
  isNearLimit: boolean;
}

export interface IAdminUserPlan {
  packageName: string;
  price: number;
  formattedPrice: string;
  billingCadence: "monthly" | "yearly" | "free";
  isTrial: boolean;
  status: string;
}

export interface IAdminUserListItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  initials: string;
  portfolio: IAdminUserPortfolio;
  plan: IAdminUserPlan | null;
  status: "active" | "trial" | "past_due" | "suspended";
  rawStatus: "active" | "inactive";
  statusBadge: {
    label: string;
    variant: "success" | "warning" | "danger" | "neutral";
  };
  joinedDate: string;
  createdAt: Date | string;
}

export interface IAdminUsersSummary {
  allCount: number;
  activeCount: number;
  trialCount: number;
  pastDueCount: number;
  suspendedCount: number;
}

export interface IAdminUsersResponse {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: IAdminUsersSummary;
  data: IAdminUserListItem[];
}

export interface IAdminUserOverviewStats {
  managedProperties: number;
  rentalUnits: number;
  activeTenants: number;
  assignedContractors: number;
}

export interface IAdminUserDetail {
  id: string;
  displayId: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  initials: string;
  address?: string;
  status: "active" | "suspended";
  statusBadge: "Active User" | "Suspended User";
  joinedDate: string;
  createdAt: Date | string;
  plan: {
    packageName: string;
    price: string;
    nextRenewal: string;
    billingCadence: string;
    paymentMethod: string;
    complianceStanding: string;
    features: string[];
    isTrial: boolean;
    status: string;
  } | null;
  stats: IAdminUserOverviewStats;
}

export interface IAdminPropertyUnitItem {
  id: string;
  unitName: string;
  unitType: string;
  beds?: number;
  baths?: number;
  floor: string;
  rentPerMonth: number;
  formattedRent: string;
  isOccupied: boolean;
  status: "Occupied" | "Vacant";
  occupant: string;
  tenant?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
}

export interface IAdminPropertyItem {
  id: string;
  propertyName: string;
  thumbnail?: string;
  propertyPhotos: string[];
  streetAddress: string;
  postCode: string;
  fullAddress: string;
  unitsBadge: string;
  epcRating: string;
  cp12Status: string;
  cp12Valid: boolean;
  totalUnits: number;
  occupiedUnits: number;
  occupancyPercentage: number;
  occupancyText: string;
  units: IAdminPropertyUnitItem[];
}

export interface IAdminTenantItem {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  initials: string;
  property: {
    id: string;
    propertyName: string;
    streetAddress: string;
  };
  unit: {
    id: string;
    unitName: string;
  };
  propertyUnitText: string;
  contract: string;
  status: string;
  leaseStartDate: Date | string;
  leaseEndDate: Date | string;
  moveInDate: string;
  rentAmount: number;
  formattedRent: string;
  tenantAccountStatus: "active" | "inactive";
}

export interface IAdminContractorItem {
  id: string;
  contractorId: string;
  name: string;
  companyName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  initials: string;
  trades: string[];
  primaryTrade: string;
  status: string;
  rating?: number;
  activeJobs: number;
  activeJobsText: string;
}

export interface IAdminUserFullDetails {
  user: IAdminUserDetail;
  properties: IAdminPropertyItem[];
  tenants: IAdminTenantItem[];
  contractors: IAdminContractorItem[];
}

export interface IAdminCascadeActionResult {
  userId: string;
  action: "suspend" | "activate" | "delete";
  userStatus: string;
  affectedTenantsCount?: number;
  affectedContractorsCount?: number;
  affectedPropertiesCount?: number;
  affectedFlatsCount?: number;
  message: string;
}

// ==========================================
// Admin Transactions Interfaces
// ==========================================

export interface IAdminTransactionStats {
  totalCollected: number;
  formattedTotalCollected: string;
  currency: string;
  currencySymbol: string;
  totalTransactions: number;
  payingPros: number;
  payingUsers?: number;
}

export interface IAdminTransactionUser {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  phone?: string;
  role?: string;
  companyName?: string;
}

export interface IAdminTransactionItem {
  id: string;
  transactionId: string;
  invoiceNumber: string;
  pro: IAdminTransactionUser;
  user: IAdminTransactionUser;
  payer: {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  payerName: string;
  subscriptionPlan: string;
  planTier: string;
  plan: string;
  billing: "Monthly" | "Annual" | "Yearly";
  billingCycle: "monthly" | "yearly";
  amount: number;
  formattedAmount: string;
  currency: string;
  currencySymbol: string;
  method: string;
  paymentGateway: string;
  providerReference: string;
  processingFee: number;
  formattedProcessingFee: string;
  status: "Settled" | "Completed" | "Pending" | "Failed" | "Refunded";
  paymentStatus: string;
  displayStatus: string;
  billingDate: string;
  formattedBillingDate: string;
  date: string;
  formattedDate: string;
  invoiceUrl: string;
  invoicePdf: string;
}

export interface IAdminTransactionDetail extends IAdminTransactionItem {
  displayTitle: string; // "Transaction: tx-9481"
  recordedDate: string; // "Oct 1, 2026"
  formattedRecordedDate: string; // "Recorded on Oct 1, 2026"
  statusBadge: string; // "SETTLED"
  statusVariant: "success" | "warning" | "danger" | "neutral";
  cardBrand?: string; // "Visa"
  cardLast4?: string; // "4242"
  account: string; // "Luis Ortega"
  canRefund: boolean;
  isRefunded: boolean;
  stripeSubscriptionId?: string;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  rawInvoice?: any;
}

export interface IAdminTransactionQuery {
  page?: number | string;
  limit?: number | string;
  status?: string; // "all" | "settled" | "completed" | "failed" | "pending" | "refunded"
  planTier?: string; // "all" | "monthly" | "annual" | "yearly" | package names
  plan?: string;
  billing?: string;
  planType?: string;
  dateRange?: string; // "all_time" | "today" | "this_week" | "this_month" | "this_year"
  range?: string;
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
  search?: string;
  q?: string;
  export?: boolean | string;
}

export interface IAdminTransactionsResponse {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
  data: IAdminTransactionItem[];
}

// ==========================================
// Admin Jobs & Orders Interfaces
// ==========================================

export interface IAdminJobsAndOrdersCounts {
  jobRequests: number;
  orders: number;
}

export interface IAdminJobRequestItem {
  id: string;
  _id: string;
  jobId: string;
  category: any;
  categoryName: string;
  serviceRequest: string;
  title: string;
  headline: string;
  description: string;
  isUrgent: boolean;
  isEmergency: boolean;
  homeowner: any;
  homeownerName: string;
  quotesReceived: number;
  quotesCount: number;
  quotesText: string;
  date: string;
  createdAt: Date | string;
  status: string;
  budget?: number;
  estimatedBudget?: number;
  propertyType?: string;
  serviceLocation?: any;
  zipCode?: string;
}

export interface IAdminJobRequestDetail extends IAdminJobRequestItem {
  formattedSubtitle: string;
  liveStage: string;
  subcategory?: string;
  service?: string;
  budgetRange?: string;
  clientDescription?: string;
  damagePhotos: string[];
  projectPhotos: string[];
  quotes: any[];
  quotations: any[];
  proQuotes: any[];
  homeownerContact: {
    id: string;
    name: string;
    isVerified: boolean;
    address: string;
    phone: string;
    email: string;
    profileImage?: string;
  };
  directPayPolicy: {
    title: string;
    description: string;
  };
  booking?: any;
}

export interface IAdminOrderItem {
  id: string;
  _id: string;
  jobId: string;
  orderId: string;
  service: string;
  title: string;
  category: any;
  categoryName: string;
  homeowner: any;
  homeownerName: string;
  client: any;
  clientName: string;
  pro: any;
  proName: string;
  professional: any;
  professionalName: string;
  status: string;
  stage: string;
  paymentStatus?: string;
  finalPrice: number;
  totalAmount: number;
  date: string;
  appointmentDate?: Date | string;
  confirmedDate?: string;
  createdAt?: Date | string;
}

export interface IAdminOrderDetail extends IAdminOrderItem {
  formattedSubtitle: string;
  liveStage: string;
  formattedFinalPrice: string;
  budget?: string;
  propertyType?: string;
  clientDescription?: string;
  completionNotes?: string;
  contractorCompletionNote?: string;
  damagePhotos: string[];
  projectPhotos: string[];
  hiredPro: {
    id: string;
    name: string;
    avatar?: string;
    profileImage?: string;
    rating: number;
    totalReviews: number;
    companyName: string;
    badgeText: string;
    tradeLicense?: any;
    liabilityInsurance?: any;
    finalAgreedPrice: number;
    formattedFinalAgreedPrice: string;
    scheduledDate?: Date | string;
    formattedScheduledDate?: string;
  };
  quoteBiddingHistory: any[];
  biddingHistory: any[];
  homeownerInformation: {
    id: string;
    name: string;
    accountVerified: boolean;
    address: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    phone: string;
    email: string;
    profileImage?: string;
  };
  paymentSummary: {
    finalPrice: number;
    formattedFinalPrice: string;
    paymentStatus: string;
    platformFee: number;
    formattedPlatformFee: string;
    transactionId: string;
    confirmedDate: string;
    paymentMethod: string;
  };
}

export interface IAdminJobRequestsResponse {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
    jobRequestsCount: number;
    ordersCount: number;
    counts: IAdminJobsAndOrdersCounts;
  };
  data: IAdminJobRequestItem[];
}

export interface IAdminOrdersResponse {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
    jobRequestsCount: number;
    ordersCount: number;
    counts: IAdminJobsAndOrdersCounts;
  };
  data: IAdminOrderItem[];
}
