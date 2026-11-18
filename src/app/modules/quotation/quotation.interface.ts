import { Types } from "mongoose";
import { ISoftDeleteModel } from "../../../types/softDelete";
import {
  QUOTATION_PARTS_MATERIALS,
  QUOTATION_PRICE_TYPE,
  QUOTATION_STATUS,
} from "./quotation.constant";

export type IQuotation = {
  jobRequest: Types.ObjectId;
  professional: Types.ObjectId;
  homeowner: Types.ObjectId;
  priceType: QUOTATION_PRICE_TYPE;
  totalRate: number;
  scopeOfWork: string;
  exclusions?: string;
  partsAndMaterialsIncluded: QUOTATION_PARTS_MATERIALS;
  estimatedDuration: string;
  earliestAvailableDate: Date;
  arrivalTimeWindow: string;
  warranty?: string;
  offerValidUntil?: Date | null;
  additionalNotes?: string;
  status: QUOTATION_STATUS;
  isHired?: boolean;
  appointmentDate?: Date | null;
  paymentMethod?: string;
  confirmedArrivalWindow?: string;
  acceptedAt?: Date | null;
  declinedAt?: Date | null;
  declineReason?: string;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type IQuotationModel = ISoftDeleteModel<IQuotation>;
