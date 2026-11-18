export enum NOTIFICATION_TYPE {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  HOME_OWNER = "home_owner",
  PROFESSIONAL = "professional",
}

export const NOTIFICATION_REFERENCE_MODELS = [
  "User",
  "Subscription",
  "Package",
  "Review",
  "Support",
  "Chat",
  "Message",
  "Category",
  "Banner",
  "Faq",
  "Rule",
  "Marquee",
  "SiteSettings",
  "Booking",
  "JobRequest",
  "Quotation",
] as const;
