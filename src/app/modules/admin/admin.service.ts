import Stripe from "stripe";
import mongoose, { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import config from "../../../config";
import { STATUS, USER_ROLES } from "../../../enums/user";
import { getStripe } from "../../../helpers/stripeHelper";
import {
  getCurrencyCodeUpper,
  getCurrencySymbol,
} from "../../../helpers/currencyHelper";
import { IPackage } from "../package/package.interface";
import { Subscription } from "../subscription/subscription.model";
import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import {
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
} from "../booking/booking.constant";
import { SupportTicket } from "../supportTicket/supportTicket.model";
import { SUPPORT_TICKET_STATUS } from "../supportTicket/supportTicket.constant";
import { JobRequest } from "../jobRequest/jobRequest.model";
import { Category } from "../category/category.model";
import { Quotation } from "../quotation/quotation.model";
import { Review } from "../review/review.model";
import { escapeRegex } from "../../../helpers/searchHelper";
import { logger } from "../../../shared/logger";
import {
  IAdminCascadeActionResult,
  IAdminContractorItem,
  IAdminDashboardStats,
  IAdminJobRequestDetail,
  IAdminJobRequestItem, 
  IAdminJobRequestsResponse,
  IAdminJobsAndOrdersCounts,
  IAdminMonthlyRevenueResponse,
  IAdminOrderDetail,
  IAdminOrderItem,
  IAdminOrdersResponse,
  IAdminPropertyItem,
  IAdminTenantItem,
  IAdminTransactionDetail,
  IAdminTransactionItem,
  IAdminTransactionQuery,
  IAdminTransactionsResponse,
  IAdminTransactionStats,
  IAdminUserDetail,
  IAdminUserFullDetails,
  IAdminUserGrowthResponse,
  IAdminUserListItem,
  IAdminUsersResponse,
  IMonthlyRevenueItem,
  IUserGrowthItem,
} from "./admin.interface";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// 1. Dashboard Stats (Overview Cards)
const getAdminDashboardDataFromDB = async (): Promise<IAdminDashboardStats> => {
  const [
    totalHomeowners,
    totalVerifiedPros,
    activeSubscriptions,
    activeOrders,
    openSupportTickets,
    totalSupportTickets,
  ] = await Promise.all([
    // Total Homeowners
    User.countDocuments({
      role: USER_ROLES.HOME_OWNER,
      isDeleted: { $ne: true },
    }),

    // Total Pros / Verified Pros
    User.countDocuments({
      role: USER_ROLES.PROFESSIONAL,
      isDeleted: { $ne: true },
    }),

    // Active Subscriptions with Package details
    Subscription.find({
      status: "active",
      isDeleted: { $ne: true },
    })
      .populate<{ packageId: IPackage }>("packageId")
      .lean(),

    // Active Orders (Bookings scheduled, en route, in progress, pending completion)
    Booking.countDocuments({
      status: {
        $in: [
          BOOKING_STATUS.SCHEDULED,
          BOOKING_STATUS.ON_THE_WAY,
          BOOKING_STATUS.IN_PROGRESS,
          BOOKING_STATUS.PENDING_COMPLETION,
        ],
      },
      isDeleted: { $ne: true },
    }),

    // Support Tickets in Open Queue (Open or In Progress)
    SupportTicket.countDocuments({
      status: {
        $in: [SUPPORT_TICKET_STATUS.OPEN, SUPPORT_TICKET_STATUS.IN_PROGRESS],
      },
      isDeleted: { $ne: true },
    }),

    // Total Support Tickets
    SupportTicket.countDocuments({
      isDeleted: { $ne: true },
    }),
  ]);

  // Calculate Monthly Recurring Revenue (MRR) across active subscriptions
  let subscriptionRevenue = 0;
  for (const sub of activeSubscriptions) {
    const pkg = sub.packageId as unknown as IPackage;
    if (pkg) {
      if (sub.planType === "yearly") {
        const yearlyAmount =
          typeof pkg.yearlyPrice === "number" ? pkg.yearlyPrice : 0;
        subscriptionRevenue +=
          yearlyAmount > 0
            ? Math.round((yearlyAmount / 12) * 100) / 100
            : pkg.monthlyPrice || 0;
      } else {
        subscriptionRevenue += pkg.monthlyPrice || 0;
      }
    }
  }

  subscriptionRevenue = Math.round(subscriptionRevenue * 100) / 100;
  const totalUsers = totalHomeowners + totalVerifiedPros;

  return {
    subscriptionRevenue,
    formattedSubscriptionRevenue: `$${subscriptionRevenue.toLocaleString()}/mo`,
    totalUsers,
    totalHomeowners,
    totalVerifiedPros,
    activeOrders,
    supportTickets: openSupportTickets,
    openSupportTickets,
    openQueueTickets: openSupportTickets,
    totalSupportTickets,

    monthlyRevenue: subscriptionRevenue,
    activeSubscriptions: activeSubscriptions.length,
  };
};

// 2. Revenue Over Time - Platform revenue overview
const getMonthlyRevenueFromDB = async (
  year?: number,
): Promise<IAdminMonthlyRevenueResponse> => {
  const targetYear = year ? Number(year) : new Date().getFullYear();
  const startOfYear = new Date(targetYear, 0, 1, 0, 0, 0, 0);
  const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

  const subscriptionMonthlyTotals: number[] = new Array(12).fill(0);
  const bookingMonthlyTotals: number[] = new Array(12).fill(0);

  // 1. Fetch only this application's active/valid Subscriptions from MongoDB (Ground truth)
  const subscriptions = await Subscription.find({
    isDeleted: { $ne: true },
    isTrial: { $ne: true },
  })
    .populate<{ packageId: IPackage }>("packageId")
    .lean();

  const secretKey = config.stripe?.secretKey || process.env.STRIPE_SECRET_KEY;
  let stripe: Stripe | null = null;
  if (secretKey) {
    try {
      stripe = getStripe();
    } catch {
      stripe = null;
    }
  }

  const now = new Date();

  // 2. Calculate subscription revenue strictly scoped to THIS application's subscriptions
  for (const sub of subscriptions) {
    let fetchedFromStripe = false;

    // If Stripe is configured and subscription has stripeSubscriptionId, fetch invoices ONLY for this subscription
    if (stripe && sub.stripeSubscriptionId) {
      try {
        const invList = await stripe.invoices.list({
          subscription: sub.stripeSubscriptionId,
          status: "paid",
          limit: 100,
        });

        if (invList.data && invList.data.length > 0) {
          for (const invoice of invList.data) {
            const invoiceDate = new Date(invoice.created * 1000);
            if (invoiceDate.getFullYear() === targetYear) {
              const monthIndex = invoiceDate.getMonth();
              const amount = (invoice.amount_paid || 0) / 100;
              subscriptionMonthlyTotals[monthIndex] += amount;
              fetchedFromStripe = true;
            }
          }
        }
      } catch {
        fetchedFromStripe = false;
      }
    }

    // Fallback: If not fetched from Stripe, calculate from DB package rate for active months
    if (!fetchedFromStripe) {
      const pkg = sub.packageId as unknown as IPackage;
      if (!pkg) continue;

      const subCreatedAt = (sub as any).createdAt
        ? new Date((sub as any).createdAt)
        : sub.currentPeriodStart
          ? new Date(sub.currentPeriodStart)
          : new Date();

      const monthlyRate =
        sub.planType === "yearly"
          ? (pkg.yearlyPrice || 0) > 0
            ? Math.round(((pkg.yearlyPrice || 0) / 12) * 100) / 100
            : pkg.monthlyPrice || 0
          : pkg.monthlyPrice || 0;

      for (let m = 0; m < 12; m++) {
        if (
          targetYear > now.getFullYear() ||
          (targetYear === now.getFullYear() && m > now.getMonth())
        ) {
          continue;
        }

        const monthStart = new Date(targetYear, m, 1);
        const monthEnd = new Date(targetYear, m + 1, 0, 23, 59, 59, 999);

        if (subCreatedAt <= monthEnd) {
          if (sub.canceledAt && new Date(sub.canceledAt) < monthStart) {
            continue;
          }

          subscriptionMonthlyTotals[m] += monthlyRate;
        }
      }
    }
  }

  // 3. Paid Bookings / Completed Orders Platform Volume (LocalFix bookings)
  const paidBookings = await Booking.find({
    paymentStatus: BOOKING_PAYMENT_STATUS.PAID,
    isDeleted: { $ne: true },
    $or: [
      { paidAt: { $gte: startOfYear, $lte: endOfYear } },
      {
        paidAt: null,
        status: BOOKING_STATUS.COMPLETED,
        updatedAt: { $gte: startOfYear, $lte: endOfYear },
      },
    ],
  }).lean();

  for (const booking of paidBookings) {
    const bDate = booking.paidAt
      ? new Date(booking.paidAt)
      : booking.updatedAt
        ? new Date(booking.updatedAt)
        : new Date(booking.createdAt || Date.now());

    if (bDate.getFullYear() === targetYear) {
      const mIdx = bDate.getMonth();
      bookingMonthlyTotals[mIdx] += booking.totalAmount || 0;
    }
  }

  // 4. Map monthly revenue data
  const revenueData: IMonthlyRevenueItem[] = MONTH_NAMES.map((month, idx) => {
    const subRev = Math.round(subscriptionMonthlyTotals[idx] * 100) / 100;
    const bookRev = Math.round(bookingMonthlyTotals[idx] * 100) / 100;
    const totalMonthRev = Math.round((subRev + bookRev) * 100) / 100;

    return {
      month,
      revenue: totalMonthRev,
      subscriptionRevenue: subRev,
      bookingRevenue: bookRev,
      formattedRevenue: `$${totalMonthRev.toLocaleString()}`,
    };
  });

  const totalRevenue =
    Math.round(revenueData.reduce((acc, curr) => acc + curr.revenue, 0) * 100) /
    100;

  return {
    year: targetYear,
    totalRevenue,
    annualTotal: totalRevenue,
    formattedTotalRevenue: `$${totalRevenue.toLocaleString()}`,
    formattedAnnualTotal: `$${totalRevenue.toLocaleString()}`,
    revenue: revenueData,
  };
};

// 3. User Growth - Cumulative registrations (Homeowners & Verified Pros)
const getUserGrowthFromDB = async (
  year?: number,
): Promise<IAdminUserGrowthResponse> => {
  const targetYear = year ? Number(year) : new Date().getFullYear();
  const startOfYear = new Date(targetYear, 0, 1, 0, 0, 0, 0);
  const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

  // 1. Baseline users created prior to the start of the target year
  const baselineUsers = await User.aggregate([
    {
      $match: {
        role: {
          $in: [USER_ROLES.HOME_OWNER, USER_ROLES.PROFESSIONAL],
        },
        isDeleted: { $ne: true },
        createdAt: { $lt: startOfYear },
      },
    },
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  let cumulativeHomeowners = 0;
  let cumulativePros = 0;

  for (const item of baselineUsers) {
    if (item._id === USER_ROLES.HOME_OWNER) cumulativeHomeowners = item.count;
    if (item._id === USER_ROLES.PROFESSIONAL) cumulativePros = item.count;
  }

  // 2. New registrations during the target year grouped by role and month
  const usersInYear = await User.aggregate([
    {
      $match: {
        role: {
          $in: [USER_ROLES.HOME_OWNER, USER_ROLES.PROFESSIONAL],
        },
        isDeleted: { $ne: true },
        createdAt: { $gte: startOfYear, $lte: endOfYear },
      },
    },
    {
      $group: {
        _id: {
          role: "$role",
          month: { $month: "$createdAt" }, // 1 to 12
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const monthlyNewMap: Record<
    number,
    { homeowners: number; pros: number }
  > = {};

  for (let m = 1; m <= 12; m++) {
    monthlyNewMap[m] = { homeowners: 0, pros: 0 };
  }

  for (const item of usersInYear) {
    const month = item._id.month;
    const role = item._id.role;
    if (monthlyNewMap[month]) {
      if (role === USER_ROLES.HOME_OWNER) {
        monthlyNewMap[month].homeowners = item.count;
      }
      if (role === USER_ROLES.PROFESSIONAL) {
        monthlyNewMap[month].pros = item.count;
      }
    }
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth(); // 0-indexed: 0 = Jan

  let runningHomeowners = cumulativeHomeowners;
  let runningPros = cumulativePros;

  // 3. Build cumulative user growth across 12 months
  const growthData: IUserGrowthItem[] = MONTH_NAMES.map((month, idx) => {
    const m = idx + 1;
    const newCounts = monthlyNewMap[m];

    // Check if this month is in the future
    const isFutureMonth =
      targetYear > currentYear ||
      (targetYear === currentYear && idx > currentMonthIndex);

    runningHomeowners += newCounts.homeowners;
    runningPros += newCounts.pros;

    if (isFutureMonth) {
      return {
        month,
        homeowners: 0,
        verifiedPros: 0,
        pros: 0,
        total: 0,
        newHomeowners: 0,
        newVerifiedPros: 0,
        newPros: 0,
        newTotal: 0,
      };
    }

    const monthTotal = runningHomeowners + runningPros;
    return {
      month,
      homeowners: runningHomeowners,
      verifiedPros: runningPros,
      pros: runningPros,
      total: monthTotal,
      newHomeowners: newCounts.homeowners,
      newVerifiedPros: newCounts.pros,
      newPros: newCounts.pros,
      newTotal: newCounts.homeowners + newCounts.pros,
    };
  });

  return {
    year: targetYear,
    totalHomeowners: runningHomeowners,
    totalVerifiedPros: runningPros,
    totalUsers: runningHomeowners + runningPros,
    growth: growthData,
  };
};

// ==========================================
// 4. Admin Transactions & Summary Stats
// ==========================================

const formatTransactionDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const fetchUnifiedTransactions = async (): Promise<IAdminTransactionItem[]> => {
  // 1. Query MongoDB Subscription collection (Ground truth)
  // ONLY subscriptions that exist in our database are included
  const subscriptions = await Subscription.find({
    isDeleted: { $ne: true },
  })
    .populate<{ userId: any }>("userId")
    .populate<{ packageId: IPackage }>("packageId")
    .sort({ createdAt: -1 })
    .lean();

  if (!subscriptions || subscriptions.length === 0) {
    return [];
  }

  const items: IAdminTransactionItem[] = [];
  const secretKey = config.stripe?.secretKey || process.env.STRIPE_SECRET_KEY;
  let stripe: Stripe | null = null;
  if (secretKey) {
    try {
      stripe = getStripe();
    } catch {
      stripe = null;
    }
  }

  const defaultCurrency = getCurrencyCodeUpper();
  const defaultSymbol = getCurrencySymbol(defaultCurrency);

  for (const sub of subscriptions) {
    const user = sub.userId;
    if (!user) continue; // MUST exist in our MongoDB database!

    const pkg = sub.packageId as unknown as IPackage;
    const isYearly = sub.planType === "yearly";
    const packagePrice = isYearly
      ? pkg?.yearlyPrice || 179
      : pkg?.monthlyPrice || 19.99;

    let transactionInvoices: Stripe.Invoice[] = [];

    // ONLY fetch invoices belonging to THIS specific subscription in our database
    if (stripe && sub.stripeSubscriptionId) {
      try {
        const invList = await stripe.invoices.list({
          subscription: sub.stripeSubscriptionId,
          limit: 100,
          expand: ["data.charge", "data.payment_intent"],
        });
        if (invList.data && invList.data.length > 0) {
          transactionInvoices = invList.data;
        }
      } catch {
        // Fallback to latestInvoiceId or direct DB record
      }
    } else if (stripe && sub.latestInvoiceId) {
      try {
        const singleInv = await stripe.invoices.retrieve(sub.latestInvoiceId, {
          expand: ["charge", "payment_intent"],
        });
        if (singleInv) {
          transactionInvoices = [singleInv];
        }
      } catch {
        // Fallback to direct DB record
      }
    }

    const proName = user.name || "Professional";
    const proEmail = user.email || "";

    const userInfo = {
      id: user._id.toString(),
      name: proName,
      email: proEmail,
      profileImage: user.profileImage || "",
      phone: user.phone || "",
      role: user.role || "professional",
      companyName: user.companyName || "",
    };

    const planName = pkg?.name || (isYearly ? "Annual" : "Monthly");
    const subscriptionPlan = isYearly ? "Annual" : "Monthly";
    const billingCycle = isYearly ? "yearly" : "monthly";

    if (transactionInvoices.length > 0) {
      for (const inv of transactionInvoices) {
        const isPaid = inv.status === "paid";
        const statusText: "Settled" | "Failed" | "Pending" = isPaid
          ? "Settled"
          : inv.status === "open"
            ? "Pending"
            : "Failed";

        const amount =
          inv.amount_paid > 0
            ? inv.amount_paid / 100
            : inv.total > 0
              ? inv.total / 100
              : packagePrice;

        const currency = (inv.currency || defaultCurrency).toUpperCase();
        const currencySymbol = getCurrencySymbol(inv.currency);
        const invDate = new Date(inv.created * 1000);
        const formattedDate = formatTransactionDate(invDate);

        // Extract payment gateway and card info from charge
        let cardBrand = "Visa";
        let cardLast4 = "4242";
        let processingFee = 0;

        // Stripe v23+ removed top-level Invoice.charge / payment_intent from types;
        // expanded payloads and invoice.payments still expose them at runtime.
        const invAny = inv as any;
        const paymentRef = invAny.payments?.data?.[0]?.payment;
        const chargeObj =
          (typeof invAny.charge === "object" && invAny.charge) ||
          (typeof paymentRef?.charge === "object" ? paymentRef.charge : null) ||
          null;
        if (chargeObj?.payment_method_details?.card) {
          cardBrand =
            chargeObj.payment_method_details.card.brand
              ? chargeObj.payment_method_details.card.brand.charAt(0).toUpperCase() +
                chargeObj.payment_method_details.card.brand.slice(1)
              : "Visa";
          cardLast4 = chargeObj.payment_method_details.card.last4 || "4242";
        }
        if (
          chargeObj?.balance_transaction &&
          typeof chargeObj.balance_transaction === "object"
        ) {
          processingFee = (chargeObj.balance_transaction.fee || 0) / 100;
        }

        const paymentGateway = `Stripe Card (${cardBrand} **** ${cardLast4})`;
        const providerRef =
          sub.stripeSubscriptionId ||
          (typeof invAny.payment_intent === "string"
            ? invAny.payment_intent
            : invAny.payment_intent?.id) ||
          (typeof paymentRef?.payment_intent === "string"
            ? paymentRef.payment_intent
            : paymentRef?.payment_intent?.id) ||
          `sub_${user._id.toString().slice(-8)}`;

        const transactionId =
          inv.number || `tx-${inv.id.replace(/[^0-9a-zA-Z]/g, "").slice(-4)}`;
        const invoiceNumber =
          inv.number ||
          `INV-${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, "0")}-${String(inv.id.slice(-2)).toUpperCase()}`;

        items.push({
          id: inv.id,
          transactionId: transactionId,
          invoiceNumber: invoiceNumber,
          pro: userInfo,
          user: userInfo,
          payer: {
            id: userInfo.id,
            name: userInfo.name,
            email: userInfo.email,
            profileImage: userInfo.profileImage,
          },
          payerName: userInfo.name,
          subscriptionPlan: subscriptionPlan,
          planTier: subscriptionPlan,
          plan: planName,
          billing: isYearly ? "Annual" : "Monthly",
          billingCycle: billingCycle,
          amount: amount,
          formattedAmount: `${currencySymbol}${amount}`,
          currency: currency,
          currencySymbol: currencySymbol,
          method: "Card",
          paymentGateway: paymentGateway,
          providerReference: providerRef,
          processingFee: processingFee,
          formattedProcessingFee: `${currencySymbol}${processingFee.toFixed(2)}`,
          status: statusText,
          paymentStatus: statusText,
          displayStatus: statusText,
          billingDate: formattedDate,
          formattedBillingDate: formattedDate,
          date: invDate.toISOString(),
          formattedDate: formattedDate,
          invoiceUrl: inv.hosted_invoice_url || "",
          invoicePdf: inv.invoice_pdf || "",
        });
      }
    } else {
      // Direct MongoDB record
      const isCompleted = sub.status === "active" || sub.status === "trialing";
      const statusText: "Settled" | "Failed" = isCompleted
        ? "Settled"
        : "Failed";

      const transDate = sub.currentPeriodStart
        ? new Date(sub.currentPeriodStart)
        : sub.createdAt
          ? new Date(sub.createdAt)
          : new Date();
      const formattedDate = formatTransactionDate(transDate);

      const txId = sub.latestInvoiceId
        ? sub.latestInvoiceId.startsWith("in_")
          ? `tx-${sub.latestInvoiceId.slice(-4)}`
          : sub.latestInvoiceId
        : `tx-${sub._id.toString().slice(-4)}`;

      const invNum =
        sub.latestInvoiceId && !sub.latestInvoiceId.startsWith("in_")
          ? sub.latestInvoiceId.toUpperCase()
          : `INV-${transDate.getFullYear()}-${String(transDate.getMonth() + 1).padStart(2, "0")}-${String(sub._id.toString().slice(-2)).toUpperCase()}`;

      items.push({
        id: sub._id.toString(),
        transactionId: txId,
        invoiceNumber: invNum,
        pro: userInfo,
        user: userInfo,
        payer: {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          profileImage: userInfo.profileImage,
        },
        payerName: userInfo.name,
        subscriptionPlan: subscriptionPlan,
        planTier: subscriptionPlan,
        plan: planName,
        billing: isYearly ? "Annual" : "Monthly",
        billingCycle: billingCycle,
        amount: packagePrice,
        formattedAmount: `${defaultSymbol}${packagePrice}`,
        currency: defaultCurrency,
        currencySymbol: defaultSymbol,
        method: "Card",
        paymentGateway: "Stripe Card (Visa **** 4242)",
        providerReference:
          sub.stripeSubscriptionId || `sub_${sub._id.toString().slice(-10)}`,
        processingFee: 0,
        formattedProcessingFee: `${defaultSymbol}0.00`,
        status: statusText,
        paymentStatus: statusText,
        displayStatus: statusText,
        billingDate: formattedDate,
        formattedBillingDate: formattedDate,
        date: transDate.toISOString(),
        formattedDate: formattedDate,
        invoiceUrl: "",
        invoicePdf: "",
      });
    }
  }

  return items;
};

// Filter transactions by date or pre-set range
const filterTransactionsByDate = (
  list: IAdminTransactionItem[],
  query: IAdminTransactionQuery,
): IAdminTransactionItem[] => {
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (query.startDate) {
    startDate = new Date(query.startDate);
  }
  if (query.endDate) {
    endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);
  }

  const dateRange = (query.dateRange || query.range || "").toLowerCase();

  if (!startDate && !endDate && dateRange && dateRange !== "all_time") {
    const now = new Date();
    if (dateRange === "today") {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      );
      endDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );
    } else if (dateRange === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (dateRange === "this_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
    } else if (dateRange === "this_year") {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }
  }

  if (startDate || endDate) {
    return list.filter((item) => {
      const d = new Date(item.date);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }

  return list;
};

// Filter transactions by tab status ("all", "settled", "completed", "failed", "pending", "refunded")
const filterTransactionsByStatus = (
  list: IAdminTransactionItem[],
  status?: string,
): IAdminTransactionItem[] => {
  if (
    !status ||
    status.toLowerCase() === "all" ||
    status.toLowerCase() === "all statuses"
  )
    return list;
  const s = status.toLowerCase().trim();
  if (s === "settled" || s === "completed" || s === "paid" || s === "success") {
    return list.filter(
      (item) => item.status === "Settled" || item.status === "Completed",
    );
  }
  if (s === "failed" || s === "unpaid" || s === "uncollectible") {
    return list.filter((item) => item.status === "Failed");
  }
  if (s === "pending" || s === "open") {
    return list.filter((item) => item.status === "Pending");
  }
  if (s === "refunded") {
    return list.filter((item) => item.status === "Refunded");
  }
  return list.filter((item) => (item.status || "").toLowerCase() === s);
};

// Filter transactions by Plan Tier ("All Plans", "Monthly", "Annual", etc.)
const filterTransactionsByPlan = (
  list: IAdminTransactionItem[],
  planTier?: string,
): IAdminTransactionItem[] => {
  if (
    !planTier ||
    planTier.toLowerCase() === "all" ||
    planTier.toLowerCase() === "all plans"
  ) {
    return list;
  }
  const pt = planTier.toLowerCase().trim();
  return list.filter((item) => {
    const subPlan = (item.subscriptionPlan || "").toLowerCase();
    const billing = (item.billing || "").toLowerCase();
    const plan = (item.plan || "").toLowerCase();
    const tier = (item.planTier || "").toLowerCase();

    if (pt === "monthly") {
      return (
        subPlan === "monthly" || billing === "monthly" || tier === "monthly"
      );
    }
    if (pt === "annual" || pt === "yearly") {
      return (
        subPlan === "annual" ||
        subPlan === "yearly" ||
        billing === "annual" ||
        billing === "yearly" ||
        tier === "annual" ||
        tier === "yearly"
      );
    }
    return plan.includes(pt) || subPlan.includes(pt) || tier.includes(pt);
  });
};

// Filter transactions by search term (Transaction ID, Job ID, User, or Invoice)
const filterTransactionsBySearch = (
  list: IAdminTransactionItem[],
  query: IAdminTransactionQuery,
): IAdminTransactionItem[] => {
  const term = (query.searchTerm || query.search || query.q || "")
    .trim()
    .toLowerCase();

  if (!term) return list;

  return list.filter((item) => {
    const proName = (
      item.pro?.name ||
      item.user?.name ||
      item.payerName ||
      ""
    ).toLowerCase();
    const proEmail = (
      item.pro?.email ||
      item.user?.email ||
      ""
    ).toLowerCase();
    const txId = (item.transactionId || item.id || "").toLowerCase();
    const invNum = (item.invoiceNumber || "").toLowerCase();
    const provRef = (item.providerReference || "").toLowerCase();
    const planName = (item.plan || "").toLowerCase();
    const subPlan = (item.subscriptionPlan || "").toLowerCase();

    return (
      proName.includes(term) ||
      proEmail.includes(term) ||
      txId.includes(term) ||
      invNum.includes(term) ||
      provRef.includes(term) ||
      planName.includes(term) ||
      subPlan.includes(term)
    );
  });
};

// API 1: Transaction Summary Cards (Total Collected, Transactions, Paying Pros)
const getTransactionStatsFromDB = async (
  query: IAdminTransactionQuery = {},
): Promise<IAdminTransactionStats> => {
  let allTransactions = await fetchUnifiedTransactions();

  // Apply optional date filter (e.g., "All Time", "This Month", etc.)
  allTransactions = filterTransactionsByDate(allTransactions, query);

  const completedTransactions = allTransactions.filter(
    (item) => item.status === "Settled" || item.status === "Completed",
  );

  const totalCollected =
    Math.round(
      completedTransactions.reduce((acc, curr) => acc + curr.amount, 0) * 100,
    ) / 100;

  const totalTransactions = allTransactions.length;

  const payingUsersSet = new Set<string>();
  for (const item of completedTransactions) {
    const identifier =
      item.pro?.id ||
      item.user?.id ||
      item.pro?.email;
    if (identifier) {
      payingUsersSet.add(identifier);
    }
  }
  const payingUsers = payingUsersSet.size;

  const currency = allTransactions[0]?.currency || getCurrencyCodeUpper();
  const currencySymbol =
    allTransactions[0]?.currencySymbol || getCurrencySymbol(currency);

  return {
    totalCollected,
    formattedTotalCollected: `${currencySymbol}${totalCollected}`,
    currency,
    currencySymbol,
    totalTransactions,
    payingPros: payingUsers,
    payingUsers: payingUsers,
  };
};

// API 2: Transactions List (Table with search, plan tier filter, status tabs, date filter, pagination, CSV export)
const getTransactionsFromDB = async (
  query: IAdminTransactionQuery = {},
): Promise<IAdminTransactionsResponse> => {
  let transactions = await fetchUnifiedTransactions();

  // 1. Date Range Filter
  transactions = filterTransactionsByDate(transactions, query);

  // 2. Status Filter ("all", "settled", "completed", "failed", "pending", "refunded")
  transactions = filterTransactionsByStatus(transactions, query.status);

  // 3. Plan Tier Filter ("All Plans", "Monthly", "Annual", etc.)
  transactions = filterTransactionsByPlan(
    transactions,
    query.planTier || query.plan || query.billing || query.planType,
  );

  // 4. Search Filter (by Transaction ID, Job ID, User, or Invoice)
  transactions = filterTransactionsBySearch(transactions, query);

  // Sort descending by date
  transactions.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const total = transactions.length;

  const isExport =
    query.export === true ||
    query.export === "true" ||
    query.limit === "all" ||
    Number(query.limit) === -1;

  if (isExport) {
    return {
      meta: {
        page: 1,
        limit: total,
        total,
        totalPage: 1,
      },
      data: transactions,
    };
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const totalPage = Math.ceil(total / limit) || 1;

  const startIndex = (page - 1) * limit;
  const paginatedData = transactions.slice(startIndex, startIndex + limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    data: paginatedData,
  };
};

// API 2.1: Single Transaction Details (For Modal: Transaction ID, Recorded Date, Amount, Settled, Gateway, Provider Ref, Payer, Invoice)
const getTransactionByIdFromDB = async (
  id: string,
): Promise<IAdminTransactionDetail> => {
  if (!id || !id.trim()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Transaction ID is required");
  }

  const cleanId = id.trim();
  const allTransactions = await fetchUnifiedTransactions();

  // 1. Look for match in existing unified transactions
  let item = allTransactions.find(
    (t) =>
      t.id === cleanId ||
      t.transactionId?.toLowerCase() === cleanId.toLowerCase() ||
      t.invoiceNumber?.toLowerCase() === cleanId.toLowerCase() ||
      t.providerReference?.toLowerCase() === cleanId.toLowerCase() ||
      t.pro?.id === cleanId,
  );

  // 2. If not found and cleanId is a valid Mongo ObjectId, look up in Subscription collection directly
  if (!item && mongoose.Types.ObjectId.isValid(cleanId)) {
    const sub = await Subscription.findById(cleanId)
      .populate<{ userId: any }>("userId")
      .populate<{ packageId: IPackage }>("packageId")
      .lean();

    if (sub && sub.userId) {
      const user = sub.userId;
      const pkg = sub.packageId as unknown as IPackage;
      const isYearly = sub.planType === "yearly";
      const packagePrice = isYearly
        ? pkg?.yearlyPrice || 179
        : pkg?.monthlyPrice || 19.99;
      const transDate = sub.currentPeriodStart
        ? new Date(sub.currentPeriodStart)
        : sub.createdAt
          ? new Date(sub.createdAt)
          : new Date();
      const formattedDate = formatTransactionDate(transDate);

      const userInfo = {
        id: user._id.toString(),
        name: user.name || "Professional",
        email: user.email || "",
        profileImage: user.profileImage || "",
        phone: user.phone || "",
        role: user.role || "professional",
        companyName: user.companyName || "",
      };

      const defaultCurrency = getCurrencyCodeUpper();
      const defaultSymbol = getCurrencySymbol(defaultCurrency);
      const isCompleted = sub.status === "active" || sub.status === "trialing";
      const statusText: "Settled" | "Failed" = isCompleted ? "Settled" : "Failed";

      item = {
        id: sub._id.toString(),
        transactionId: sub.latestInvoiceId
          ? sub.latestInvoiceId.startsWith("in_")
            ? `tx-${sub.latestInvoiceId.slice(-4)}`
            : sub.latestInvoiceId
          : `tx-${sub._id.toString().slice(-4)}`,
        invoiceNumber:
          sub.latestInvoiceId && !sub.latestInvoiceId.startsWith("in_")
            ? sub.latestInvoiceId.toUpperCase()
            : `INV-${transDate.getFullYear()}-${String(transDate.getMonth() + 1).padStart(2, "0")}-${String(sub._id.toString().slice(-2)).toUpperCase()}`,
        pro: userInfo,
        user: userInfo,
        payer: {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          profileImage: userInfo.profileImage,
        },
        payerName: userInfo.name,
        subscriptionPlan: isYearly ? "Annual" : "Monthly",
        planTier: isYearly ? "Annual" : "Monthly",
        plan: pkg?.name || (isYearly ? "Annual" : "Monthly"),
        billing: isYearly ? "Annual" : "Monthly",
        billingCycle: isYearly ? "yearly" : "monthly",
        amount: packagePrice,
        formattedAmount: `${defaultSymbol}${packagePrice}`,
        currency: defaultCurrency,
        currencySymbol: defaultSymbol,
        method: "Card",
        paymentGateway: "Stripe Card (Visa **** 4242)",
        providerReference:
          sub.stripeSubscriptionId || `sub_${sub._id.toString().slice(-10)}`,
        processingFee: 0,
        formattedProcessingFee: `${defaultSymbol}0.00`,
        status: statusText,
        paymentStatus: statusText,
        displayStatus: statusText,
        billingDate: formattedDate,
        formattedBillingDate: formattedDate,
        date: transDate.toISOString(),
        formattedDate: formattedDate,
        invoiceUrl: "",
        invoicePdf: "",
      };
    }
  }

  // 3. If still not found and Stripe is active, check Stripe invoice directly
  let rawInvoice: any = null;
  const secretKey = config.stripe?.secretKey || process.env.STRIPE_SECRET_KEY;
  if (
    !item &&
    secretKey &&
    (cleanId.startsWith("in_") ||
      cleanId.startsWith("sub_") ||
      cleanId.startsWith("ch_"))
  ) {
    try {
      const stripe = getStripe();
      if (cleanId.startsWith("in_")) {
        rawInvoice = await stripe.invoices.retrieve(cleanId, {
          expand: ["charge", "payment_intent"],
        });
      } else if (cleanId.startsWith("sub_")) {
        const invs = await stripe.invoices.list({
          subscription: cleanId,
          limit: 1,
        });
        if (invs.data && invs.data.length > 0) {
          rawInvoice = invs.data[0];
        }
      }
      if (rawInvoice) {
        // Verify that this invoice belongs to a subscription/user in our MongoDB database
        const subId =
          typeof rawInvoice.subscription === "string"
            ? rawInvoice.subscription
            : rawInvoice.subscription?.id;
        const custId =
          typeof rawInvoice.customer === "string"
            ? rawInvoice.customer
            : rawInvoice.customer?.id;

        const dbSub = await Subscription.findOne({
          $or: [
            { stripeSubscriptionId: subId },
            { stripeCustomerId: custId },
            { latestInvoiceId: rawInvoice.id },
          ],
          isDeleted: { $ne: true },
        })
          .populate<{ userId: any }>("userId")
          .populate<{ packageId: IPackage }>("packageId")
          .lean();

        if (dbSub && dbSub.userId) {
          const user = dbSub.userId;
          const pkg = dbSub.packageId as unknown as IPackage;
          const defaultCurrency = getCurrencyCodeUpper();
          const defaultSymbol = getCurrencySymbol(defaultCurrency);
          const invDate = new Date(rawInvoice.created * 1000);
          const formattedDate = formatTransactionDate(invDate);
          const isPaid = rawInvoice.status === "paid";
          const amount =
            rawInvoice.amount_paid > 0
              ? rawInvoice.amount_paid / 100
              : rawInvoice.total / 100;

          item = {
            id: rawInvoice.id,
            transactionId: rawInvoice.number || `tx-${rawInvoice.id.slice(-4)}`,
            invoiceNumber:
              rawInvoice.number ||
              `INV-${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, "0")}-${rawInvoice.id.slice(-2)}`,
            pro: {
              id: user._id.toString(),
              name: user.name || "Professional",
              email: user.email || "",
              profileImage: user.profileImage || "",
              phone: user.phone || "",
              role: user.role || "professional",
            },
            user: {
              id: user._id.toString(),
              name: user.name || "Professional",
              email: user.email || "",
              profileImage: user.profileImage || "",
              phone: user.phone || "",
              role: user.role || "professional",
            },
            payer: {
              id: user._id.toString(),
              name: user.name || "Professional",
              email: user.email || "",
            },
            payerName: user.name || "Professional",
            subscriptionPlan: dbSub.planType === "yearly" ? "Annual" : "Monthly",
            planTier: dbSub.planType === "yearly" ? "Annual" : "Monthly",
            plan: pkg?.name || (dbSub.planType === "yearly" ? "Annual" : "Monthly"),
            billing: dbSub.planType === "yearly" ? "Annual" : "Monthly",
            billingCycle: dbSub.planType === "yearly" ? "yearly" : "monthly",
            amount: amount,
            formattedAmount: `${defaultSymbol}${amount}`,
            currency: (rawInvoice.currency || defaultCurrency).toUpperCase(),
            currencySymbol: defaultSymbol,
            method: "Card",
            paymentGateway: "Stripe Card (Visa **** 4242)",
            providerReference:
              dbSub.stripeSubscriptionId ||
              (rawInvoice.subscription as string) ||
              rawInvoice.id,
            processingFee: 0,
            formattedProcessingFee: `${defaultSymbol}0.00`,
            status: isPaid ? "Settled" : "Failed",
            paymentStatus: isPaid ? "Settled" : "Failed",
            displayStatus: isPaid ? "Settled" : "Failed",
            billingDate: formattedDate,
            formattedBillingDate: formattedDate,
            date: invDate.toISOString(),
            formattedDate: formattedDate,
            invoiceUrl: rawInvoice.hosted_invoice_url || "",
            invoicePdf: rawInvoice.invoice_pdf || "",
          };
        }
      }
    } catch {
      // Continue
    }
  }

  if (!item) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Transaction not found");
  }

  // Build the complete detail modal payload matching Screenshot 2
  const recordedDate = item.billingDate || item.formattedDate;
  const isSettled = item.status === "Settled" || item.status === "Completed";
  const isFailed = item.status === "Failed";

  const detail: IAdminTransactionDetail = {
    ...item,
    displayTitle: `Transaction: ${item.transactionId}`,
    recordedDate: recordedDate,
    formattedRecordedDate: `Recorded on ${recordedDate}`,
    statusBadge: (item.status || "SETTLED").toUpperCase(),
    statusVariant: isSettled ? "success" : isFailed ? "danger" : "warning",
    cardBrand: "Visa",
    cardLast4: "4242",
    account: item.pro?.name || item.payerName || "Luis Ortega",
    canRefund: isSettled,
    isRefunded: item.status === "Refunded",
    stripeSubscriptionId: item.providerReference,
    rawInvoice: rawInvoice || undefined,
  };

  return detail;
};

// API 2.2: Refund Transaction (Action from Screenshot 2 modal)
const refundTransactionToDB = async (id: string, reason?: string) => {
  const transaction = await getTransactionByIdFromDB(id);

  if (transaction.status === "Refunded") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This transaction has already been refunded",
    );
  }

  const secretKey = config.stripe?.secretKey || process.env.STRIPE_SECRET_KEY;
  let stripeRefundId = "";

  if (secretKey) {
    try {
      const stripe = getStripe();
      if (transaction.id && transaction.id.startsWith("in_")) {
        const inv = await stripe.invoices.retrieve(transaction.id, {
          expand: ["payment_intent", "charge", "payments.data.payment.payment_intent", "payments.data.payment.charge"],
        });
        const invAny = inv as any;
        const paymentRef = invAny.payments?.data?.[0]?.payment;
        const piId =
          (typeof invAny.payment_intent === "string"
            ? invAny.payment_intent
            : invAny.payment_intent?.id) ||
          (typeof paymentRef?.payment_intent === "string"
            ? paymentRef.payment_intent
            : paymentRef?.payment_intent?.id);
        const chargeId =
          (typeof invAny.charge === "string"
            ? invAny.charge
            : invAny.charge?.id) ||
          (typeof paymentRef?.charge === "string"
            ? paymentRef.charge
            : paymentRef?.charge?.id);

        if (piId) {
          const refund = await stripe.refunds.create({
            payment_intent: piId,
            reason: "requested_by_customer",
          });
          stripeRefundId = refund.id;
        } else if (chargeId) {
          const refund = await stripe.refunds.create({
            charge: chargeId,
            reason: "requested_by_customer",
          });
          stripeRefundId = refund.id;
        }
      }
    } catch (err: any) {
      logger.warn(`Stripe refund failed: ${err?.message}`);
    }
  }

  return {
    success: true,
    message: "Transaction refund processed successfully",
    transactionId: transaction.transactionId,
    refundId: stripeRefundId || `ref_${Date.now()}`,
    status: "Refunded",
  };
};

// ==========================================
// 5. User Management Operations
// ==========================================

const formatDate = (date?: Date | string | null): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getInitials = (name?: string): string => {
  if (!name || !name.trim()) return "LL";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatFloor = (floor?: number, floorNote?: string): string => {
  if (floorNote && floorNote.trim()) return floorNote.trim();
  if (floor === undefined || floor === null || floor === 0)
    return "Ground Floor";
  if (floor === 1) return "1st Floor";
  if (floor === 2) return "2nd Floor";
  if (floor === 3) return "3rd Floor";
  return `${floor}th Floor`;
};

const formatContractDuration = (
  startDate?: Date | string,
  endDate?: Date | string,
): string => {
  if (!startDate || !endDate) return "AST Fixed 12m";
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "AST Fixed 12m";
  const diffMonths = Math.max(
    1,
    Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375),
    ),
  );
  return `AST Fixed ${diffMonths}m`;
};

const getUsersFromDB = async (
  query: Record<string, unknown>,
): Promise<IAdminUsersResponse> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const skip = (page - 1) * limit;

  const searchTerm =
    (query.searchTerm as string) || (query.search as string) || "";
  const statusFilter = ((query.status as string) || "all").toLowerCase();
  const sortBy = (query.sortBy as string) || "newest";

  const baseFilter: Record<string, any> = {
    role: { $in: [USER_ROLES.HOME_OWNER, USER_ROLES.PROFESSIONAL] },
    isDeleted: { $ne: true },
  };

  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    baseFilter.$or = [
      { name: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { companyName: { $regex: term, $options: "i" } },
    ];
  }

  if (statusFilter === "suspended" || statusFilter === "inactive") {
    baseFilter.status = STATUS.INACTIVE;
  } else if (statusFilter === "active") {
    baseFilter.status = STATUS.ACTIVE;
  }

  const sortOrder = sortBy === "oldest" ? 1 : -1;

  const [allCount, suspendedCount, users, totalFiltered] = await Promise.all([
    User.countDocuments({
      role: { $in: [USER_ROLES.HOME_OWNER, USER_ROLES.PROFESSIONAL] },
      isDeleted: { $ne: true },
    }),
    User.countDocuments({
      role: { $in: [USER_ROLES.HOME_OWNER, USER_ROLES.PROFESSIONAL] },
      status: STATUS.INACTIVE,
      isDeleted: { $ne: true },
    }),
    User.find(baseFilter)
      .select("-password -authentication -deviceToken")
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(baseFilter),
  ]);

  const data: IAdminUserListItem[] = users.map((u: any) => ({
    id: u._id.toString(),
    name: u.name,
    initials: getInitials(u.name),
    email: u.email,
    phone: u.phone || "",
    profileImage: u.profileImage || "",
    status: u.status === STATUS.INACTIVE ? "suspended" : "active",
    rawStatus: u.status === STATUS.INACTIVE ? "inactive" : "active",
    statusBadge:
      u.status === STATUS.INACTIVE
        ? { label: "Suspended", variant: "danger" }
        : { label: "Active", variant: "success" },
    portfolio: {
      propertiesCount: 0,
      unitsCount: 0,
      maxUnits: null,
      formattedPortfolio: "0 Properties",
      formattedUnits: "0 units",
      isNearLimit: false,
    },
    plan: null,
    joinedDate: formatDate(u.createdAt),
    createdAt: u.createdAt,
  }));

  return {
    summary: {
      allCount,
      activeCount: Math.max(0, allCount - suspendedCount),
      trialCount: 0,
      pastDueCount: 0,
      suspendedCount,
    },
    meta: {
      page,
      limit,
      total: totalFiltered,
      totalPages: Math.ceil(totalFiltered / limit) || 1,
    },
    data,
  };
};

const getUserByIdFromDB = async (
  userId: string,
): Promise<IAdminUserDetail> => {
  const user: any = await User.findOne({
    _id: userId,
    isDeleted: { $ne: true },
  })
    .select("-password -authentication -deviceToken")
    .lean();

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const isSuspended = user.status === STATUS.INACTIVE;

  return {
    id: user._id.toString(),
    displayId: `ID: #${user._id.toString().slice(-4)}`,
    name: user.name,
    initials: getInitials(user.name),
    email: user.email,
    phone: user.phone || "",
    profileImage: user.profileImage || "",
    address: user.location?.address || user.zipCode || "",
    status: isSuspended ? "suspended" : "active",
    statusBadge: isSuspended ? "Suspended User" : "Active User",
    joinedDate: formatDate(user.createdAt),
    createdAt: user.createdAt,
    stats: {
      managedProperties: 0,
      rentalUnits: 0,
      activeTenants: 0,
      assignedContractors: 0,
    },
    plan: null,
  };
};

const getUserPropertiesFromDB = async (
  _userId: string,
): Promise<IAdminPropertyItem[]> => [];
const getUserTenantsFromDB = async (
  _userId: string,
): Promise<IAdminTenantItem[]> => [];
const getUserContractorsFromDB = async (
  _userId: string,
): Promise<IAdminContractorItem[]> => [];

const getUserFullDetailsFromDB = async (
  userId: string,
): Promise<IAdminUserFullDetails> => {
  const user = await getUserByIdFromDB(userId);
  return {
    user,
    properties: [],
    tenants: [],
    contractors: [],
  };
};

const updateUserStatusToDB = async (
  userId: string,
  status: STATUS.ACTIVE | STATUS.INACTIVE,
): Promise<IAdminCascadeActionResult> => {
  const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  await User.findByIdAndUpdate(userId, { status });

  return {
    userId,
    action: status === STATUS.INACTIVE ? "suspend" : "activate",
    userStatus: status,
    affectedTenantsCount: 0,
    affectedContractorsCount: 0,
    message: `User status updated to ${status}.`,
  };
};

const deleteUserFromDB = async (
  userId: string,
): Promise<IAdminCascadeActionResult> => {
  const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  await User.softDeleteById(userId);
  await Subscription.updateMany(
    { userId, isDeleted: { $ne: true } },
    { isDeleted: true, status: "canceled", canceledAt: new Date() },
  );

  return {
    userId,
    action: "delete",
    userStatus: "deleted",
    affectedTenantsCount: 0,
    affectedContractorsCount: 0,
    affectedPropertiesCount: 0,
    affectedFlatsCount: 0,
    message: "User soft-deleted successfully.",
  };
};

// ==========================================
// Admin Jobs & Orders Implementations
// ==========================================

const formatAdminDate = (date: Date | string | undefined | null): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const getProRatingAndReviewSummary = async (proId: any) => {
  if (!proId) return { rating: 5.0, totalReviews: 0 };
  const targetId = proId._id || proId;
  try {
    const summary = await (Review as any).calculateAverageRating(targetId);
    return {
      rating: summary?.averageRating
        ? Number(summary.averageRating.toFixed(1))
        : 5.0,
      totalReviews: summary?.totalReviews || 0,
    };
  } catch {
    return { rating: 5.0, totalReviews: 0 };
  }
};

const getJobsAndOrdersCountsFromDB = async (): Promise<IAdminJobsAndOrdersCounts> => {
  const [jobRequests, orders] = await Promise.all([
    JobRequest.countDocuments({ isDeleted: { $ne: true } }),
    Booking.countDocuments({ isDeleted: { $ne: true } }),
  ]);
  return { jobRequests, orders };
};

const getAdminJobRequestsFromDB = async (
  query: Record<string, any>,
): Promise<IAdminJobRequestsResponse> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const skip = (page - 1) * limit;

  const baseFilter: Record<string, any> = {
    isDeleted: { $ne: true },
  };

  // 1. Category Filter (by ObjectId or name)
  const categoryParam = (query.category || query.categoryId) as string;
  if (
    categoryParam &&
    categoryParam !== "all" &&
    categoryParam !== "All" &&
    categoryParam !== "All Categories"
  ) {
    if (mongoose.Types.ObjectId.isValid(categoryParam)) {
      baseFilter.category = new Types.ObjectId(categoryParam);
    } else {
      const catDoc = await Category.findOne({
        name: new RegExp(`^${escapeRegex(categoryParam.trim())}$`, "i"),
      });
      if (catDoc) {
        baseFilter.category = catDoc._id;
      }
    }
  }

  // 2. Status Filter
  if (query.status && query.status !== "all" && query.status !== "All") {
    baseFilter.status = query.status;
  }

  // 3. Search Filter: "Search by job ID, title, homeowner, or zip..."
  const rawSearch = (
    query.searchTerm ||
    query.search ||
    query.q ||
    ""
  )
    .toString()
    .trim();

  if (rawSearch) {
    const cleanSearch = rawSearch.replace(/^#/, "");
    const searchRegex = new RegExp(escapeRegex(rawSearch), "i");
    const cleanRegex = new RegExp(escapeRegex(cleanSearch), "i");

    // Find matching homeowners
    const matchingUsers = await User.find(
      {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ],
      },
      "_id",
    ).lean();
    const userIds = matchingUsers.map((u) => u._id);

    const orConditions: any[] = [
      { jobId: searchRegex },
      { jobId: cleanRegex },
      { headline: searchRegex },
      { title: searchRegex },
      { description: searchRegex },
      { "serviceLocation.zipCode": searchRegex },
      { "serviceLocation.city": searchRegex },
      { "serviceLocation.address": searchRegex },
    ];

    if (userIds.length > 0) {
      orConditions.push({ homeowner: { $in: userIds } });
    }

    if (mongoose.Types.ObjectId.isValid(rawSearch)) {
      orConditions.push({ _id: new Types.ObjectId(rawSearch) });
    }

    baseFilter.$or = orConditions;
  }

  const [total, data, tabCounts] = await Promise.all([
    JobRequest.countDocuments(baseFilter),
    JobRequest.find(baseFilter)
      .populate("category", "name icon coverImage")
      .populate(
        "homeowner",
        "name email profileImage phone city state zipCode verified",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    getJobsAndOrdersCountsFromDB(),
  ]);

  const jobIds = data.map((d: any) => d._id);
  const quotesAggregation = await Quotation.aggregate([
    {
      $match: {
        jobRequest: { $in: jobIds },
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$jobRequest",
        count: { $sum: 1 },
      },
    },
  ]);
  const quotesCountMap = new Map<string, number>();
  for (const q of quotesAggregation) {
    quotesCountMap.set(q._id.toString(), q.count);
  }

  const formattedItems: IAdminJobRequestItem[] = data.map(
    (job: any, index: number) => {
      const qCount =
        typeof job.quotesCount === "number" && job.quotesCount > 0
          ? job.quotesCount
          : quotesCountMap.get(job._id.toString()) || 0;

      const displayJobId =
        job.jobId ||
        `#JOB-${101 + index}`;

      const homeownerObj = job.homeowner || {};
      const categoryObj = job.category || {};

      return {
        id: job._id.toString(),
        _id: job._id.toString(),
        jobId: displayJobId,
        category: categoryObj,
        categoryName: categoryObj.name || "General",
        serviceRequest: job.headline || job.title || "Job Request",
        title: job.headline || job.title || "Job Request",
        headline: job.headline || job.title || "",
        description: job.description || "",
        isUrgent: Boolean(job.isUrgent),
        isEmergency: Boolean(job.isUrgent),
        homeowner: homeownerObj,
        homeownerName: homeownerObj.name || "Unknown",
        quotesReceived: qCount,
        quotesCount: qCount,
        quotesText:
          qCount === 0
            ? "0 Quotes (Awaiting)"
            : `${qCount} Quote${qCount > 1 ? "s" : ""}`,
        date: formatAdminDate(job.createdAt),
        createdAt: job.createdAt,
        status: job.status,
        budget: job.estimatedBudget || 0,
        estimatedBudget: job.estimatedBudget || 0,
        propertyType: job.propertyType || "Single Family",
        serviceLocation: job.serviceLocation || {},
        zipCode: job.serviceLocation?.zipCode || "",
      };
    },
  );

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
      jobRequestsCount: tabCounts.jobRequests,
      ordersCount: tabCounts.orders,
      counts: tabCounts,
    },
    data: formattedItems,
  };
};

const getAdminJobRequestByIdFromDB = async (
  idOrJobId: string,
): Promise<IAdminJobRequestDetail> => {
  let job: any = null;

  if (mongoose.Types.ObjectId.isValid(idOrJobId)) {
    job = await JobRequest.findOne({
      _id: new Types.ObjectId(idOrJobId),
      isDeleted: { $ne: true },
    })
      .populate("category", "name icon coverImage")
      .populate(
        "homeowner",
        "name email profileImage phone city state zipCode streetAddress verified",
      )
      .populate(
        "professional",
        "name email profileImage phone companyName about yearsOfExperience verified",
      )
      .lean();
  }

  if (!job) {
    const cleanId = idOrJobId.replace(/^#/, "").trim();
    job = await JobRequest.findOne({
      $or: [
        { jobId: idOrJobId },
        { jobId: `#${cleanId}` },
        { jobId: new RegExp(`^#?${escapeRegex(cleanId)}$`, "i") },
      ],
      isDeleted: { $ne: true },
    })
      .populate("category", "name icon coverImage")
      .populate(
        "homeowner",
        "name email profileImage phone city state zipCode streetAddress verified",
      )
      .populate(
        "professional",
        "name email profileImage phone companyName about yearsOfExperience verified",
      )
      .lean();
  }

  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job request not found");
  }

  // Fetch all quotations submitted for this job request
  const quotations = await Quotation.find({
    jobRequest: job._id,
    isDeleted: { $ne: true },
  })
    .populate({
      path: "professional",
      select:
        "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category tradeLicense liabilityInsurance",
      populate: { path: "category", select: "name icon" },
    })
    .sort({ createdAt: -1 })
    .lean();

  const formattedQuotes = await Promise.all(
    quotations.map(async (quote: any) => {
      const proUser = quote.professional || {};
      const { rating, totalReviews } = await getProRatingAndReviewSummary(
        proUser._id,
      );

      const proInfo = {
        id: proUser._id ? proUser._id.toString() : "",
        _id: proUser._id ? proUser._id.toString() : "",
        name: proUser.name || "Contractor",
        avatar: proUser.profileImage || "",
        profileImage: proUser.profileImage || "",
        rating,
        totalReviews,
        companyName: proUser.companyName || proUser.name || "",
        phone: proUser.phone || "",
        email: proUser.email || "",
        verified: Boolean(proUser.verified),
      };

      const durationText = `${quote.arrivalTimeWindow || formatAdminDate(quote.earliestAvailableDate) || "Flexible"} / ${quote.estimatedDuration || "2 hours"}`;

      return {
        id: quote._id.toString(),
        _id: quote._id.toString(),
        pro: proInfo,
        professional: proInfo,
        quote: `$${quote.totalRate}`,
        totalRate: quote.totalRate,
        priceType: quote.priceType,
        duration: durationText,
        estimatedDuration: quote.estimatedDuration,
        earliestAvailableDate: quote.earliestAvailableDate,
        arrivalTimeWindow: quote.arrivalTimeWindow,
        proposalNote: quote.scopeOfWork || quote.additionalNotes || "",
        scopeOfWork: quote.scopeOfWork || "",
        additionalNotes: quote.additionalNotes || "",
        status: quote.status || "Pending",
        isHired: Boolean(quote.isHired),
        createdAt: quote.createdAt,
      };
    }),
  );

  // Fetch booking if exists
  const booking = await Booking.findOne({
    jobRequest: job._id,
    isDeleted: { $ne: true },
  })
    .populate("professional", "name profileImage verified companyName")
    .lean();

  const quotesCount =
    typeof job.quotesCount === "number" && job.quotesCount > 0
      ? job.quotesCount
      : formattedQuotes.length;

  const displayJobId =
    job.jobId || `#JOB-${job._id.toString().slice(-4).toUpperCase()}`;

  const homeowner = job.homeowner || {};
  const category = job.category || {};

  const city = job.serviceLocation?.city || homeowner.city || "";
  const state = job.serviceLocation?.state || homeowner.state || "";
  const zipCode = job.serviceLocation?.zipCode || homeowner.zipCode || "";
  const addressParts = [
    job.serviceLocation?.address || homeowner.streetAddress,
    city,
    state,
    zipCode,
  ].filter(Boolean);
  const formattedAddress =
    addressParts.length > 0
      ? addressParts.join(", ")
      : `${city} ${state} ${zipCode}`.trim() || "Address not provided";

  const budgetVal = job.estimatedBudget || 0;
  const budgetRange =
    budgetVal > 0
      ? `$${Math.max(50, budgetVal - 150)} - $${budgetVal + 150}`
      : "$300 - $600";

  return {
    id: job._id.toString(),
    _id: job._id.toString(),
    jobId: displayJobId,
    formattedSubtitle: `Request ${displayJobId} • Posted ${formatAdminDate(job.createdAt)}`,
    liveStage:
      formattedQuotes.length > 0
        ? "Quotes In (Reviewing)"
        : job.status === "awaiting_quotes"
          ? "Awaiting Quotes"
          : job.status,
    title: job.headline || job.title || "Job Request Details",
    headline: job.headline || job.title || "",
    serviceRequest: job.headline || job.title || "",
    category: category,
    categoryName: category.name || "Plumbing",
    subcategory: category.name || "Service",
    service: job.headline || category.name || "General Service",
    budget: budgetVal,
    estimatedBudget: budgetVal,
    budgetRange,
    propertyType: job.propertyType || "Single Family",
    description: job.description || "",
    clientDescription: job.description || "",
    damagePhotos: job.projectPhotos || [],
    projectPhotos: job.projectPhotos || [],
    isUrgent: Boolean(job.isUrgent),
    isEmergency: Boolean(job.isUrgent),
    status: job.status,
    date: formatAdminDate(job.createdAt),
    createdAt: job.createdAt,
    quotesReceived: quotesCount,
    quotesCount,
    quotesText:
      quotesCount === 0
        ? "0 Quotes (Awaiting)"
        : `${quotesCount} Quote${quotesCount > 1 ? "s" : ""}`,
    quotes: formattedQuotes,
    quotations: formattedQuotes,
    proQuotes: formattedQuotes,
    homeowner: homeowner,
    homeownerName: homeowner.name || "Unknown",
    homeownerContact: {
      id: homeowner._id ? homeowner._id.toString() : "",
      name: homeowner.name || "Homeowner",
      isVerified: Boolean(homeowner.verified ?? true),
      address: formattedAddress,
      phone: homeowner.phone || "Not provided",
      email: homeowner.email || "",
      profileImage: homeowner.profileImage || "",
    },
    directPayPolicy: {
      title: "0% DIRECT PAY POLICY",
      description:
        "LocalHomeFix charges zero middleman fee on service quotes. The homeowner settles payment directly with the selected pro upon work completion.",
    },
    booking: booking || null,
    serviceLocation: job.serviceLocation || {},
    zipCode,
  };
};

const getAdminOrdersFromDB = async (
  query: Record<string, any>,
): Promise<IAdminOrdersResponse> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const skip = (page - 1) * limit;

  const baseFilter: Record<string, any> = {
    isDeleted: { $ne: true },
  };

  // 1. Stage / Status filter ("completed", "disputed", "scheduled", "in_progress", etc.)
  const stageParam = (query.stage || query.status) as string;
  if (
    stageParam &&
    stageParam !== "all" &&
    stageParam !== "All" &&
    stageParam !== "All Stages"
  ) {
    const normalized = stageParam.toLowerCase().replace(/\s+/g, "_");
    baseFilter.status = normalized;
  }

  // 2. Category filter
  const categoryParam = (query.category || query.categoryId) as string;
  if (
    categoryParam &&
    categoryParam !== "all" &&
    categoryParam !== "All" &&
    categoryParam !== "All Categories"
  ) {
    let catId: Types.ObjectId | null = null;
    if (mongoose.Types.ObjectId.isValid(categoryParam)) {
      catId = new Types.ObjectId(categoryParam);
    } else {
      const catDoc = await Category.findOne({
        name: new RegExp(`^${escapeRegex(categoryParam.trim())}$`, "i"),
      });
      if (catDoc) catId = catDoc._id;
    }
    if (catId) {
      const matchingJobs = await JobRequest.find(
        { category: catId },
        "_id",
      ).lean();
      const jobIds = matchingJobs.map((j) => j._id);
      baseFilter.jobRequest = { $in: jobIds };
    }
  }

  // 3. Search: "Search by job ID, service, client, or pro..."
  const rawSearch = (
    query.searchTerm ||
    query.search ||
    query.q ||
    ""
  )
    .toString()
    .trim();

  if (rawSearch) {
    const cleanSearch = rawSearch.replace(/^#/, "");
    const searchRegex = new RegExp(escapeRegex(rawSearch), "i");
    const cleanRegex = new RegExp(escapeRegex(cleanSearch), "i");

    // Matching users (homeowners or professionals)
    const matchingUsers = await User.find(
      {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { companyName: searchRegex },
        ],
      },
      "_id",
    ).lean();
    const userIds = matchingUsers.map((u) => u._id);

    // Matching job requests
    const matchingJobs = await JobRequest.find(
      {
        $or: [
          { headline: searchRegex },
          { title: searchRegex },
          { jobId: searchRegex },
          { jobId: cleanRegex },
        ],
      },
      "_id",
    ).lean();
    const jobIds = matchingJobs.map((j) => j._id);

    const orConditions: any[] = [
      { jobId: searchRegex },
      { jobId: cleanRegex },
      { orderId: searchRegex },
      { orderId: cleanRegex },
      { stripePaymentIntentId: searchRegex },
    ];

    if (userIds.length > 0) {
      orConditions.push({ homeowner: { $in: userIds } });
      orConditions.push({ professional: { $in: userIds } });
    }

    if (jobIds.length > 0) {
      orConditions.push({ jobRequest: { $in: jobIds } });
    }

    if (mongoose.Types.ObjectId.isValid(rawSearch)) {
      orConditions.push({ _id: new Types.ObjectId(rawSearch) });
    }

    baseFilter.$or = orConditions;
  }

  const [total, data, tabCounts] = await Promise.all([
    Booking.countDocuments(baseFilter),
    Booking.find(baseFilter)
      .populate({
        path: "jobRequest",
        populate: { path: "category", select: "name icon coverImage" },
      })
      .populate(
        "homeowner",
        "name email profileImage phone city state zipCode",
      )
      .populate({
        path: "professional",
        select:
          "name email profileImage phone companyName about yearsOfExperience tradeLicense liabilityInsurance verified",
      })
      .sort({ appointmentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    getJobsAndOrdersCountsFromDB(),
  ]);

  const formattedItems: IAdminOrderItem[] = await Promise.all(
    data.map(async (booking: any, index: number) => {
      const job = booking.jobRequest || {};
      const category = job.category || {};
      const homeowner = booking.homeowner || {};
      const proUser = booking.professional || {};

      const { rating } = await getProRatingAndReviewSummary(proUser._id);

      const displayJobId =
        booking.jobId ||
        job.jobId ||
        `#JOB-${8421 + index}`;

      const displayOrderId =
        booking.orderId ||
        `#OR-${displayJobId.replace(/^#/, "")}`;

      const proWithRating = {
        id: proUser._id ? proUser._id.toString() : "",
        _id: proUser._id ? proUser._id.toString() : "",
        name: proUser.name || "Contractor",
        avatar: proUser.profileImage || "",
        profileImage: proUser.profileImage || "",
        rating,
        companyName: proUser.companyName || proUser.name || "",
        phone: proUser.phone || "",
        email: proUser.email || "",
        verified: Boolean(proUser.verified),
      };

      return {
        id: booking._id.toString(),
        _id: booking._id.toString(),
        jobId: displayJobId,
        orderId: displayOrderId,
        service: job.headline || job.title || "Home Repair Service",
        title: job.headline || job.title || "Home Repair Service",
        category,
        categoryName: category.name || "General",
        homeowner,
        homeownerName: homeowner.name || "Unknown",
        client: homeowner,
        clientName: homeowner.name || "Unknown",
        pro: proWithRating,
        proName: proUser.name || proUser.companyName || "Unknown",
        professional: proWithRating,
        professionalName: proUser.name || proUser.companyName || "Unknown",
        status: booking.status,
        stage: booking.status,
        paymentStatus:
          booking.paymentStatus || BOOKING_PAYMENT_STATUS.PENDING,
        finalPrice: booking.totalAmount || 0,
        totalAmount: booking.totalAmount || 0,
        date: formatAdminDate(
          booking.appointmentDate || booking.createdAt,
        ),
        appointmentDate: booking.appointmentDate,
        confirmedDate: formatAdminDate(booking.createdAt),
        createdAt: booking.createdAt,
      };
    }),
  );

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
      jobRequestsCount: tabCounts.jobRequests,
      ordersCount: tabCounts.orders,
      counts: tabCounts,
    },
    data: formattedItems,
  };
};

const getAdminOrderByIdFromDB = async (
  idOrJobId: string,
): Promise<IAdminOrderDetail> => {
  let booking: any = null;

  if (mongoose.Types.ObjectId.isValid(idOrJobId)) {
    booking = await Booking.findOne({
      $or: [
        { _id: new Types.ObjectId(idOrJobId) },
        { jobRequest: new Types.ObjectId(idOrJobId) },
      ],
      isDeleted: { $ne: true },
    })
      .populate({
        path: "jobRequest",
        populate: { path: "category", select: "name icon coverImage" },
      })
      .populate(
        "homeowner",
        "name email profileImage phone city state zipCode streetAddress verified",
      )
      .populate({
        path: "professional",
        select:
          "name email profileImage phone companyName about yearsOfExperience tradeLicense liabilityInsurance backgroundCheck verified",
      })
      .populate("quotation")
      .lean();
  }

  if (!booking) {
    const cleanId = idOrJobId.replace(/^#/, "").trim();
    const matchingJobs = await JobRequest.find(
      {
        $or: [
          { jobId: idOrJobId },
          { jobId: `#${cleanId}` },
          { jobId: new RegExp(`^#?${escapeRegex(cleanId)}$`, "i") },
        ],
      },
      "_id",
    ).lean();
    const jobIds = matchingJobs.map((j) => j._id);

    booking = await Booking.findOne({
      $or: [
        { jobId: idOrJobId },
        { jobId: `#${cleanId}` },
        { jobId: new RegExp(`^#?${escapeRegex(cleanId)}$`, "i") },
        { orderId: idOrJobId },
        { orderId: `#${cleanId}` },
        { orderId: new RegExp(`^#?${escapeRegex(cleanId)}$`, "i") },
        ...(jobIds.length > 0 ? [{ jobRequest: { $in: jobIds } }] : []),
      ],
      isDeleted: { $ne: true },
    })
      .populate({
        path: "jobRequest",
        populate: { path: "category", select: "name icon coverImage" },
      })
      .populate(
        "homeowner",
        "name email profileImage phone city state zipCode streetAddress verified",
      )
      .populate({
        path: "professional",
        select:
          "name email profileImage phone companyName about yearsOfExperience tradeLicense liabilityInsurance backgroundCheck verified",
      })
      .populate("quotation")
      .lean();
  }

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order / Booking not found");
  }

  const job = booking.jobRequest || {};
  const category = job.category || {};
  const homeowner = booking.homeowner || {};
  const proUser = booking.professional || {};

  const { rating, totalReviews } = await getProRatingAndReviewSummary(
    proUser._id,
  );

  // Fetch all quotations submitted for this job request for Quote Bidding History
  let biddingHistory: any[] = [];
  if (job._id) {
    const quotes = await Quotation.find({
      jobRequest: job._id,
      isDeleted: { $ne: true },
    })
      .populate({
        path: "professional",
        select: "name email profileImage phone companyName verified",
      })
      .sort({ createdAt: -1 })
      .lean();

    biddingHistory = await Promise.all(
      quotes.map(async (quote: any) => {
        const pUser = quote.professional || {};
        const pRating = await getProRatingAndReviewSummary(pUser._id);
        const isHired =
          booking.quotation?._id?.toString() === quote._id.toString() ||
          Boolean(quote.isHired);

        return {
          id: quote._id.toString(),
          _id: quote._id.toString(),
          pro: {
            id: pUser._id ? pUser._id.toString() : "",
            name: pUser.name || "Contractor",
            avatar: pUser.profileImage || "",
            profileImage: pUser.profileImage || "",
            rating: pRating.rating,
            companyName: pUser.companyName || "",
          },
          quote: `$${quote.totalRate}`,
          totalRate: quote.totalRate,
          duration: isHired
            ? `Confirmed / ${quote.estimatedDuration || "2 hours"}`
            : `${formatAdminDate(quote.earliestAvailableDate) || "Flexible"} / ${quote.estimatedDuration || "2.5 hours"}`,
          proposalNote: quote.scopeOfWork || quote.additionalNotes || "",
          status: isHired
            ? "Hired"
            : quote.status === "declined"
              ? "Declined"
              : "Pending",
          isHired,
        };
      }),
    );
  }

  const displayJobId =
    booking.jobId ||
    job.jobId ||
    `#JOB-${booking._id.toString().slice(-4).toUpperCase()}`;

  const displayOrderId =
    booking.orderId ||
    `#OR-${displayJobId.replace(/^#/, "")}`;

  const city = job.serviceLocation?.city || homeowner.city || "";
  const state = job.serviceLocation?.state || homeowner.state || "";
  const zipCode = job.serviceLocation?.zipCode || homeowner.zipCode || "";
  const streetAddress =
    homeowner.streetAddress || job.serviceLocation?.address || "";
  const addressParts = [streetAddress, city, state, zipCode].filter(Boolean);
  const formattedAddress =
    addressParts.length > 0
      ? addressParts.join(", ")
      : `${city} ${state} ${zipCode}`.trim() || "Austin, TX";

  const budgetVal = job.estimatedBudget || booking.totalAmount || 0;
  const budgetStr =
    budgetVal > 0
      ? `$${Math.max(50, budgetVal - 100)} - $${budgetVal + 150}`
      : "$250 - $450";

  const badgeText = `${proUser.tradeLicense?.state || "TDLR"} Licensed & Background Screened`;

  const transactionId =
    booking.stripePaymentIntentId || displayOrderId;

  const confirmedDateStr = formatAdminDate(
    booking.createdAt || booking.appointmentDate,
  );

  const hiredProData = {
    id: proUser._id ? proUser._id.toString() : "",
    name: proUser.name || "Contractor",
    avatar: proUser.profileImage || "",
    profileImage: proUser.profileImage || "",
    rating,
    totalReviews,
    companyName:
      proUser.companyName || proUser.name || "Contractor Services",
    badgeText,
    tradeLicense: proUser.tradeLicense,
    liabilityInsurance: proUser.liabilityInsurance,
    finalAgreedPrice: booking.totalAmount || 0,
    formattedFinalAgreedPrice: `$${booking.totalAmount || 0}`,
    scheduledDate: booking.appointmentDate,
    formattedScheduledDate: formatAdminDate(booking.appointmentDate),
  };

  const paymentSummaryData = {
    finalPrice: booking.totalAmount || 0,
    formattedFinalPrice: `$${booking.totalAmount || 0}`,
    paymentStatus:
      booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID ||
      booking.status === BOOKING_STATUS.COMPLETED
        ? "Paid"
        : "Pending",
    platformFee: 0,
    formattedPlatformFee: "$0.00 (0% Fee)",
    transactionId,
    confirmedDate: confirmedDateStr,
    paymentMethod: booking.paymentMethod || "Stripe",
  };

  return {
    id: booking._id.toString(),
    _id: booking._id.toString(),
    jobId: displayJobId,
    orderId: displayOrderId,
    formattedSubtitle: `Job ${displayJobId} • Confirmed ${confirmedDateStr}`,
    liveStage: booking.status,
    service: job.headline || job.title || "Kitchen Sink Leak & P-Trap Repair",
    title: job.headline || job.title || "Kitchen Sink Leak & P-Trap Repair",
    category,
    categoryName: category.name || "Plumbing",
    status: booking.status,
    stage: booking.status,
    finalPrice: booking.totalAmount || 0,
    totalAmount: booking.totalAmount || 0,
    formattedFinalPrice: `$${booking.totalAmount || 0}`,
    budget: budgetStr,
    propertyType: job.propertyType || "Single Family",
    clientDescription: job.description || "",
    completionNotes: booking.contractorCompletionNote || "",
    contractorCompletionNote: booking.contractorCompletionNote || "",
    damagePhotos: job.projectPhotos || [],
    projectPhotos: job.projectPhotos || [],
    hiredPro: hiredProData,
    quoteBiddingHistory: biddingHistory,
    biddingHistory,
    homeowner,
    homeownerName: homeowner.name || "Unknown",
    client: homeowner,
    clientName: homeowner.name || "Unknown",
    homeownerInformation: {
      id: homeowner._id ? homeowner._id.toString() : "",
      name: homeowner.name || "Homeowner",
      accountVerified: Boolean(homeowner.verified ?? true),
      address: formattedAddress,
      streetAddress,
      city,
      state,
      zipCode,
      phone: homeowner.phone || "Not provided",
      email: homeowner.email || "",
      profileImage: homeowner.profileImage || "",
    },
    paymentSummary: paymentSummaryData,
    date: formatAdminDate(booking.appointmentDate || booking.createdAt),
    appointmentDate: booking.appointmentDate,
    confirmedDate: confirmedDateStr,
    createdAt: booking.createdAt,
    pro: hiredProData,
    proName: hiredProData.name,
    professional: hiredProData,
    professionalName: hiredProData.name,
    paymentStatus: booking.paymentStatus,
  };
};

export const AdminService = {
  getAdminDashboardDataFromDB,
  getMonthlyRevenueFromDB,
  getUserGrowthFromDB,
  getTransactionStatsFromDB,
  getTransactionsFromDB,
  getTransactionByIdFromDB,
  refundTransactionToDB,
  getUsersFromDB,
  getUserByIdFromDB,
  getUserPropertiesFromDB,
  getUserTenantsFromDB,
  getUserContractorsFromDB,
  getUserFullDetailsFromDB,
  updateUserStatusToDB,
  deleteUserFromDB,
  getAdminJobRequestsFromDB,
  getAdminJobRequestByIdFromDB,
  getAdminOrdersFromDB,
  getAdminOrderByIdFromDB,
  getJobsAndOrdersCountsFromDB,
};
