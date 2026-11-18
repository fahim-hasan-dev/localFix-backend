"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotationFilterableFields = exports.quotationSearchableFields = exports.QUOTATION_PARTS_MATERIALS = exports.QUOTATION_PRICE_TYPE = exports.QUOTATION_STATUS = void 0;
var QUOTATION_STATUS;
(function (QUOTATION_STATUS) {
    QUOTATION_STATUS["PENDING"] = "pending";
    QUOTATION_STATUS["ACCEPTED"] = "accepted";
    QUOTATION_STATUS["DECLINED"] = "declined";
    QUOTATION_STATUS["REJECTED"] = "rejected";
    QUOTATION_STATUS["WITHDRAWN"] = "withdrawn";
    QUOTATION_STATUS["EXPIRED"] = "expired";
})(QUOTATION_STATUS || (exports.QUOTATION_STATUS = QUOTATION_STATUS = {}));
var QUOTATION_PRICE_TYPE;
(function (QUOTATION_PRICE_TYPE) {
    QUOTATION_PRICE_TYPE["ESTIMATE"] = "estimate";
    QUOTATION_PRICE_TYPE["FIXED"] = "fixed";
    QUOTATION_PRICE_TYPE["HOURLY"] = "hourly";
    QUOTATION_PRICE_TYPE["TIME_AND_MATERIALS"] = "timeandmaterials";
})(QUOTATION_PRICE_TYPE || (exports.QUOTATION_PRICE_TYPE = QUOTATION_PRICE_TYPE = {}));
var QUOTATION_PARTS_MATERIALS;
(function (QUOTATION_PARTS_MATERIALS) {
    QUOTATION_PARTS_MATERIALS["PARTS_INCLUDED"] = "parts_included";
    QUOTATION_PARTS_MATERIALS["LABOR_ONLY"] = "labor_only";
    QUOTATION_PARTS_MATERIALS["YES_ALL_PARTS_AND_FITTINGS_INCLUDED"] = "yes_all_parts_and_fittings_included";
    QUOTATION_PARTS_MATERIALS["NO_LABOUR_ONLY"] = "no_labour_only";
})(QUOTATION_PARTS_MATERIALS || (exports.QUOTATION_PARTS_MATERIALS = QUOTATION_PARTS_MATERIALS = {}));
exports.quotationSearchableFields = [
    "scopeOfWork",
    "exclusions",
    "warranty",
    "additionalNotes",
    "priceType",
    "partsAndMaterialsIncluded",
];
exports.quotationFilterableFields = [
    "searchTerm",
    "jobRequest",
    "professional",
    "homeowner",
    "status",
    "priceType",
];
