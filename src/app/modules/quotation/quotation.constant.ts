export enum QUOTATION_STATUS {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  REJECTED = "rejected",
  WITHDRAWN = "withdrawn",
  EXPIRED = "expired",
}

export enum QUOTATION_PRICE_TYPE {
  ESTIMATE = "estimate",
  FIXED = "fixed",
  HOURLY = "hourly",
  TIME_AND_MATERIALS = "timeandmaterials",
}

export enum QUOTATION_PARTS_MATERIALS {
  PARTS_INCLUDED = "parts_included",
  LABOR_ONLY = "labor_only",
  YES_ALL_PARTS_AND_FITTINGS_INCLUDED = "yes_all_parts_and_fittings_included",
  NO_LABOUR_ONLY = "no_labour_only",
}

export const quotationSearchableFields = [
  "scopeOfWork",
  "exclusions",
  "warranty",
  "additionalNotes",
  "priceType",
  "partsAndMaterialsIncluded",
];

export const quotationFilterableFields = [
  "searchTerm",
  "jobRequest",
  "professional",
  "homeowner",
  "status",
  "priceType",
];
