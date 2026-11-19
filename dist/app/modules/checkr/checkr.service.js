"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckrService = void 0;
const axios_1 = __importDefault(require("axios"));
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../../config"));
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const user_1 = require("../../../enums/user");
const user_model_1 = require("../user/user.model");
const notificationsHelper_1 = require("../../../helpers/notificationsHelper");
const notification_constant_1 = require("../notification/notification.constant");
const checkr_constant_1 = require("./checkr.constant");
const checkrClient = axios_1.default.create({
    baseURL: config_1.default.checkr.baseUrl,
    auth: {
        username: config_1.default.checkr.apiKey,
        password: "",
    },
});
const ensureCheckrConfigured = () => {
    if (!config_1.default.checkr.apiKey) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Checkr API key is not configured");
    }
};
/**
 * Checkr only accepts letters, numbers, spaces, hyphens, apostrophes, periods, and commas
 * in name fields. Strip everything else (emoji, underscores, unicode scripts Checkr rejects, etc.).
 */
const sanitizeCheckrNamePart = (value) => {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics after NFKD
        .replace(/[^\p{L}\p{N}\s\-'.]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
};
const isValidCheckrNamePart = (value) => {
    if (!value || value.length < 1 || value.length > 100)
        return false;
    // Must contain at least one letter; Checkr rejects digit-only / punctuation-only names.
    if (!/\p{L}/u.test(value))
        return false;
    return /^[\p{L}\p{N}\s\-'.]+$/u.test(value);
};
const splitFullName = (fullName) => {
    const parts = sanitizeCheckrNamePart(fullName)
        .split(/\s+/)
        .map((part) => sanitizeCheckrNamePart(part))
        .filter(Boolean);
    if (parts.length === 0) {
        return {
            first_name: "Professional",
            last_name: "User",
            no_middle_name: true,
        };
    }
    if (parts.length === 1) {
        const only = parts[0];
        return {
            first_name: only,
            last_name: only,
            no_middle_name: true,
        };
    }
    if (parts.length === 2) {
        return {
            first_name: parts[0],
            last_name: parts[1],
            no_middle_name: true,
        };
    }
    return {
        first_name: parts[0],
        middle_name: parts.slice(1, -1).join(" "),
        last_name: parts[parts.length - 1],
        no_middle_name: false,
    };
};
/** Digits-only US phone for Checkr (optional field). */
const sanitizeCheckrPhone = (phone) => {
    if (!phone)
        return undefined;
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10)
        return digits;
    if (digits.length === 11 && digits.startsWith("1"))
        return digits.slice(1);
    // Keep E.164-ish if already long enough; otherwise omit rather than fail candidate create.
    if (digits.length >= 10 && digits.length <= 15)
        return digits;
    return undefined;
};
const sanitizeCheckrZip = (zip) => {
    if (!zip)
        return undefined;
    const match = zip.trim().match(/\b(\d{5})(?:-\d{4})?\b/);
    return match === null || match === void 0 ? void 0 : match[1];
};
const buildWorkLocations = (state, city) => {
    const stateCode = (0, checkr_constant_1.normalizeUsStateCode)(state);
    if (stateCode) {
        return [
            Object.assign({ country: "US", state: stateCode }, (city ? { city } : {})),
        ];
    }
    return [{ country: "US" }];
};
const extractCheckrErrorMessage = (error) => {
    var _a;
    const data = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data;
    if (typeof (data === null || data === void 0 ? void 0 : data.error) === "string")
        return data.error;
    if (Array.isArray(data === null || data === void 0 ? void 0 : data.error))
        return data.error.join(", ");
    if (typeof (data === null || data === void 0 ? void 0 : data.message) === "string")
        return data.message;
    return (error === null || error === void 0 ? void 0 : error.message) || "Checkr API request failed";
};
/**
 * Create a Checkr candidate for a service professional (hosted screening flow).
 * Invitation flow only strictly requires email — names are included when valid.
 */
const createCandidate = (candidateData) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    ensureCheckrConfigured();
    const split = splitFullName(candidateData.name);
    const firstName = isValidCheckrNamePart(split.first_name)
        ? split.first_name
        : "";
    const lastName = isValidCheckrNamePart(split.last_name)
        ? split.last_name
        : "";
    const middleName = split.middle_name && isValidCheckrNamePart(split.middle_name)
        ? split.middle_name
        : undefined;
    const phone = sanitizeCheckrPhone(candidateData.phone);
    const zipcode = sanitizeCheckrZip(candidateData.zipcode);
    // Hosted invitation: email alone is enough. Only send names Checkr will accept.
    const payload = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ email: candidateData.email.trim().toLowerCase() }, (firstName && lastName
        ? Object.assign({ first_name: firstName, last_name: lastName }, (middleName ? { middle_name: middleName } : { no_middle_name: true })) : {})), (phone ? { phone } : {})), (zipcode ? { zipcode } : {})), (candidateData.custom_id ? { custom_id: candidateData.custom_id } : {})), (((_a = candidateData.work_locations) === null || _a === void 0 ? void 0 : _a.length)
        ? { work_locations: candidateData.work_locations }
        : {}));
    try {
        const response = yield checkrClient.post("/v1/candidates", payload);
        return response.data;
    }
    catch (error) {
        console.error("Checkr Candidate Creation Failed:", {
            status: (_b = error.response) === null || _b === void 0 ? void 0 : _b.status,
            error: ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message,
            payload: {
                email: payload.email,
                first_name: payload.first_name,
                last_name: payload.last_name,
                phone: payload.phone,
                zipcode: payload.zipcode,
            },
        });
        throw new ApiErrors_1.default(((_d = error.response) === null || _d === void 0 ? void 0 : _d.status) || http_status_codes_1.StatusCodes.BAD_GATEWAY, extractCheckrErrorMessage(error));
    }
});
/**
 * Create a Checkr hosted invitation link so the professional can complete screening on Checkr Portal.
 */
const createInvitation = (candidateId, workLocations) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    ensureCheckrConfigured();
    const payload = Object.assign({ candidate_id: candidateId, package: config_1.default.checkr.backgroundCheckPackage }, ((workLocations === null || workLocations === void 0 ? void 0 : workLocations.length) ? { work_locations: workLocations } : {}));
    try {
        const response = yield checkrClient.post("/v1/invitations", payload);
        return response.data;
    }
    catch (error) {
        console.error("Checkr Invitation Creation Failed:", {
            status: (_a = error.response) === null || _a === void 0 ? void 0 : _a.status,
            error: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message,
        });
        throw new ApiErrors_1.default(((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) || http_status_codes_1.StatusCodes.BAD_GATEWAY, extractCheckrErrorMessage(error));
    }
});
const getInvitation = (invitationId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    ensureCheckrConfigured();
    try {
        const response = yield checkrClient.get(`/v1/invitations/${invitationId}`);
        return response.data;
    }
    catch (error) {
        throw new ApiErrors_1.default(((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || http_status_codes_1.StatusCodes.BAD_GATEWAY, extractCheckrErrorMessage(error));
    }
});
const getReport = (reportId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    ensureCheckrConfigured();
    try {
        const response = yield checkrClient.get(`/v1/reports/${reportId}`);
        return response.data;
    }
    catch (error) {
        throw new ApiErrors_1.default(((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || http_status_codes_1.StatusCodes.BAD_GATEWAY, extractCheckrErrorMessage(error));
    }
});
/**
 * Initiate Checkr background screening (Candidate + Hosted Invitation URL) for a registered professional.
 */
const initiateBackgroundCheckForUser = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    const user = yield user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User not found");
    }
    if (user.role !== user_1.USER_ROLES.PROFESSIONAL) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Background check is only required for professional accounts");
    }
    if (((_a = user.backgroundCheck) === null || _a === void 0 ? void 0 : _a.status) === user_1.CHECKR_VERIFICATION_STATUS.VERIFIED) {
        return {
            candidateId: user.backgroundCheck.checkrCandidateId || null,
            invitationId: user.backgroundCheck.checkrInvitationId || null,
            invitationUrl: user.backgroundCheck.checkrInvitationUrl || null,
            status: user.backgroundCheck.status,
            invitationStatus: user.backgroundCheck.invitationStatus,
            package: user.backgroundCheck.checkrPackage ||
                config_1.default.checkr.backgroundCheckPackage,
            alreadyVerified: true,
        };
    }
    // Reuse existing pending invitation unless forceNew or expired
    if (!(options === null || options === void 0 ? void 0 : options.forceNew) &&
        ((_b = user.backgroundCheck) === null || _b === void 0 ? void 0 : _b.checkrInvitationId) &&
        ((_c = user.backgroundCheck) === null || _c === void 0 ? void 0 : _c.checkrInvitationUrl) &&
        ((_d = user.backgroundCheck) === null || _d === void 0 ? void 0 : _d.invitationStatus) === user_1.CHECKR_INVITATION_STATUS.PENDING) {
        return {
            candidateId: user.backgroundCheck.checkrCandidateId || null,
            invitationId: user.backgroundCheck.checkrInvitationId,
            invitationUrl: user.backgroundCheck.checkrInvitationUrl,
            status: user.backgroundCheck.status || user_1.CHECKR_VERIFICATION_STATUS.PENDING,
            invitationStatus: user.backgroundCheck.invitationStatus,
            package: user.backgroundCheck.checkrPackage ||
                config_1.default.checkr.backgroundCheckPackage,
        };
    }
    const stateForWorkLocation = ((_e = user.tradeLicense) === null || _e === void 0 ? void 0 : _e.state) || user.state;
    const workLocations = buildWorkLocations(stateForWorkLocation, user.city);
    let candidateId = (_f = user.backgroundCheck) === null || _f === void 0 ? void 0 : _f.checkrCandidateId;
    if (!candidateId) {
        const candidate = yield createCandidate({
            name: user.name,
            email: user.email,
            phone: user.phone,
            zipcode: user.zipCode,
            custom_id: user._id.toString(),
            work_locations: workLocations,
        });
        candidateId = candidate.id;
    }
    const invitation = yield createInvitation(candidateId, workLocations);
    const now = new Date();
    yield user_model_1.User.findByIdAndUpdate(user._id, {
        $set: {
            "backgroundCheck.consentAccepted": true,
            "backgroundCheck.consentAcceptedAt": ((_g = user.backgroundCheck) === null || _g === void 0 ? void 0 : _g.consentAcceptedAt) || now,
            "backgroundCheck.status": user_1.CHECKR_VERIFICATION_STATUS.PENDING,
            "backgroundCheck.checkrCandidateId": candidateId,
            "backgroundCheck.checkrInvitationId": invitation.id,
            "backgroundCheck.checkrInvitationUrl": invitation.invitation_url,
            "backgroundCheck.invitationStatus": user_1.CHECKR_INVITATION_STATUS.PENDING,
            "backgroundCheck.checkrPackage": invitation.package || config_1.default.checkr.backgroundCheckPackage,
            "backgroundCheck.lastCheckedAt": now,
            "backgroundCheck.notes": "Checkr screening invitation created. Awaiting candidate completion.",
        },
    });
    return {
        candidateId,
        invitationId: invitation.id,
        invitationUrl: invitation.invitation_url,
        status: user_1.CHECKR_VERIFICATION_STATUS.PENDING,
        invitationStatus: user_1.CHECKR_INVITATION_STATUS.PENDING,
        package: invitation.package || config_1.default.checkr.backgroundCheckPackage,
    };
});
/**
 * Create a Checkr candidate + hosted screening invitation prior to final signup submission
 * (supports "Start on Checkr" button on Step 4 before clicking "Submit Application & Finish").
 */
const startPreSignupScreening = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const existingUser = yield user_model_1.User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.verified) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "This email is already registered!");
    }
    if (existingUser && existingUser.role === user_1.USER_ROLES.PROFESSIONAL) {
        return initiateBackgroundCheckForUser(existingUser._id.toString());
    }
    const workLocations = buildWorkLocations(payload.state);
    const candidate = yield createCandidate({
        name: payload.name,
        email: normalizedEmail,
        phone: payload.phone,
        zipcode: payload.zipCode,
        work_locations: workLocations,
    });
    const invitation = yield createInvitation(candidate.id, workLocations);
    return {
        candidateId: candidate.id,
        invitationId: invitation.id,
        invitationUrl: invitation.invitation_url,
        status: user_1.CHECKR_VERIFICATION_STATUS.PENDING,
        invitationStatus: user_1.CHECKR_INVITATION_STATUS.PENDING,
        package: invitation.package || config_1.default.checkr.backgroundCheckPackage,
    };
});
/**
 * Map a Checkr report object to User backgroundCheck update fields.
 */
const mapReportToVerificationState = (reportObj) => {
    const rawStatus = ((reportObj === null || reportObj === void 0 ? void 0 : reportObj.status) || "").toLowerCase();
    const rawResult = (reportObj === null || reportObj === void 0 ? void 0 : reportObj.result)
        ? String(reportObj.result).toLowerCase()
        : null;
    let mappedStatus = user_1.CHECKR_VERIFICATION_STATUS.PENDING;
    let passed = false;
    let notes = "Background check is in progress.";
    if (rawStatus === "complete" || rawStatus === "completed") {
        if (rawResult === "clear") {
            mappedStatus = user_1.CHECKR_VERIFICATION_STATUS.VERIFIED;
            passed = true;
            notes = "Checkr background check clear.";
        }
        else {
            mappedStatus = user_1.CHECKR_VERIFICATION_STATUS.REVIEW_REQUIRED;
            passed = false;
            notes = "Checkr background check requires manual review.";
        }
    }
    else if (rawStatus === "pending" || rawStatus === "suspended") {
        mappedStatus = user_1.CHECKR_VERIFICATION_STATUS.PENDING;
        notes =
            rawStatus === "suspended"
                ? "Checkr background check is temporarily suspended."
                : "Checkr background check is pending.";
    }
    else if (rawStatus === "canceled" || rawStatus === "disputed") {
        mappedStatus = user_1.CHECKR_VERIFICATION_STATUS.FAILED;
        notes = `Checkr background check ${rawStatus}.`;
    }
    return { mappedStatus, passed, rawResult, notes };
};
/**
 * Fetch background check status for a user, optionally syncing live state from Checkr API.
 */
const getBackgroundCheckStatusFromDB = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, syncWithCheckr = false) {
    const user = yield user_model_1.User.findById(userId).select("name email role approvalStatus backgroundCheck");
    if (!user) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User not found");
    }
    if (syncWithCheckr && user.backgroundCheck) {
        const { checkrReportId, checkrInvitationId } = user.backgroundCheck;
        if (checkrReportId) {
            const report = yield getReport(checkrReportId);
            const { mappedStatus, passed, rawResult, notes } = mapReportToVerificationState(report);
            const updateFields = {
                "backgroundCheck.status": mappedStatus,
                "backgroundCheck.passed": passed,
                "backgroundCheck.result": rawResult,
                "backgroundCheck.lastCheckedAt": new Date(),
                "backgroundCheck.notes": notes,
            };
            if (mappedStatus === user_1.CHECKR_VERIFICATION_STATUS.VERIFIED) {
                updateFields["backgroundCheck.verifiedAt"] =
                    user.backgroundCheck.verifiedAt || new Date();
                updateFields.approvalStatus = user_1.APPROVAL_STATUS.APPROVED;
            }
            const updated = yield user_model_1.User.findByIdAndUpdate(user._id, { $set: updateFields }, { new: true }).select("name email role approvalStatus backgroundCheck");
            return updated;
        }
        if (checkrInvitationId) {
            const invitation = yield getInvitation(checkrInvitationId);
            const invStatus = ((invitation === null || invitation === void 0 ? void 0 : invitation.status) || "").toLowerCase();
            const mappedInvStatus = invStatus === "completed"
                ? user_1.CHECKR_INVITATION_STATUS.COMPLETED
                : invStatus === "expired"
                    ? user_1.CHECKR_INVITATION_STATUS.EXPIRED
                    : user_1.CHECKR_INVITATION_STATUS.PENDING;
            const updateFields = {
                "backgroundCheck.invitationStatus": mappedInvStatus,
                "backgroundCheck.lastCheckedAt": new Date(),
            };
            if (invitation === null || invitation === void 0 ? void 0 : invitation.report_id) {
                updateFields["backgroundCheck.checkrReportId"] = invitation.report_id;
            }
            const updated = yield user_model_1.User.findByIdAndUpdate(user._id, { $set: updateFields }, { new: true }).select("name email role approvalStatus backgroundCheck");
            return updated;
        }
    }
    return user;
});
/**
 * Process Checkr webhook events (invitation & report lifecycle) and update the Professional user.
 */
const processWebhookEvent = (event) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!event || !((_a = event.data) === null || _a === void 0 ? void 0 : _a.object)) {
        return { processed: false, reason: "Invalid event payload" };
    }
    const dataObj = event.data.object;
    const eventType = event.type || "";
    // 1. Handle Invitation lifecycle events
    if (dataObj.object === "invitation" || eventType.startsWith("invitation.")) {
        const invitationId = dataObj.id;
        const candidateId = dataObj.candidate_id;
        const rawStatus = (dataObj.status || "").toLowerCase();
        const user = yield user_model_1.User.findOne({
            $or: [
                ...(invitationId
                    ? [{ "backgroundCheck.checkrInvitationId": invitationId }]
                    : []),
                ...(candidateId
                    ? [{ "backgroundCheck.checkrCandidateId": candidateId }]
                    : []),
            ],
        });
        if (!user) {
            return {
                processed: false,
                reason: "User not found for invitation event",
            };
        }
        let invitationStatus = user_1.CHECKR_INVITATION_STATUS.PENDING;
        let notes = "Checkr invitation pending.";
        if (eventType === "invitation.completed" || rawStatus === "completed") {
            invitationStatus = user_1.CHECKR_INVITATION_STATUS.COMPLETED;
            notes =
                "Checkr screening portal completed by professional. Report is processing.";
        }
        else if (eventType === "invitation.expired" || rawStatus === "expired") {
            invitationStatus = user_1.CHECKR_INVITATION_STATUS.EXPIRED;
            notes = "Checkr invitation expired. Please request a new screening link.";
        }
        const updateFields = {
            "backgroundCheck.invitationStatus": invitationStatus,
            "backgroundCheck.lastCheckedAt": new Date(),
            "backgroundCheck.notes": notes,
        };
        if (dataObj.report_id) {
            updateFields["backgroundCheck.checkrReportId"] = dataObj.report_id;
        }
        if (invitationStatus === user_1.CHECKR_INVITATION_STATUS.COMPLETED) {
            updateFields["backgroundCheck.status"] =
                user_1.CHECKR_VERIFICATION_STATUS.PENDING;
        }
        yield user_model_1.User.findByIdAndUpdate(user._id, { $set: updateFields });
        return { processed: true, userId: user._id.toString(), invitationStatus };
    }
    // 2. Handle Report lifecycle events (criminal/background check)
    if (dataObj.object === "report" || eventType.startsWith("report.")) {
        const reportId = dataObj.id;
        const candidateId = dataObj.candidate_id;
        const user = yield user_model_1.User.findOne({
            $or: [
                ...(reportId ? [{ "backgroundCheck.checkrReportId": reportId }] : []),
                ...(candidateId
                    ? [{ "backgroundCheck.checkrCandidateId": candidateId }]
                    : []),
            ],
        });
        if (!user) {
            return { processed: false, reason: "User not found for report event" };
        }
        const { mappedStatus, passed, rawResult, notes } = mapReportToVerificationState(dataObj);
        const updateData = {
            "backgroundCheck.checkrReportId": reportId,
            "backgroundCheck.status": mappedStatus,
            "backgroundCheck.passed": passed,
            "backgroundCheck.result": rawResult,
            "backgroundCheck.invitationStatus": user_1.CHECKR_INVITATION_STATUS.COMPLETED,
            "backgroundCheck.lastCheckedAt": new Date(),
            "backgroundCheck.notes": notes,
        };
        if (dataObj.package) {
            updateData["backgroundCheck.checkrPackage"] = dataObj.package;
        }
        if (mappedStatus === user_1.CHECKR_VERIFICATION_STATUS.VERIFIED) {
            updateData["backgroundCheck.verifiedAt"] = new Date();
            updateData.approvalStatus = user_1.APPROVAL_STATUS.APPROVED;
        }
        yield user_model_1.User.findByIdAndUpdate(user._id, { $set: updateData });
        // Notify Professional
        let title = "Background Check Update";
        let text = `Your background check status is now ${mappedStatus}.`;
        if (mappedStatus === user_1.CHECKR_VERIFICATION_STATUS.VERIFIED) {
            title = "Background Check Clear";
            text =
                "Your Checkr background check passed! Your professional account is now verified.";
        }
        else if (mappedStatus === user_1.CHECKR_VERIFICATION_STATUS.REVIEW_REQUIRED) {
            title = "Background Check Under Review";
            text =
                "Your background check requires manual admin review before activation.";
        }
        else if (mappedStatus === user_1.CHECKR_VERIFICATION_STATUS.FAILED) {
            title = "Background Check Failed";
            text =
                "Your background check could not be completed. Please contact support.";
        }
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: user._id.toString(),
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            title,
            text,
            referenceId: user._id.toString(),
            referenceModel: "User",
        });
        // Notify Super Admin when review is required or failed
        if (mappedStatus === user_1.CHECKR_VERIFICATION_STATUS.REVIEW_REQUIRED ||
            mappedStatus === user_1.CHECKR_VERIFICATION_STATUS.FAILED) {
            const superAdmin = yield user_model_1.User.findOne({
                role: user_1.USER_ROLES.SUPER_ADMIN,
            }).select("_id");
            if (superAdmin) {
                yield (0, notificationsHelper_1.sendNotifications)({
                    receiver: superAdmin._id.toString(),
                    type: notification_constant_1.NOTIFICATION_TYPE.ADMIN,
                    title: "Professional Background Check Review Required",
                    text: `Professional ${user.name} (${user.email}) background check status: ${mappedStatus}.`,
                    referenceId: user._id.toString(),
                    referenceModel: "User",
                });
            }
        }
        return {
            processed: true,
            userId: user._id.toString(),
            status: mappedStatus,
        };
    }
    return { processed: false, reason: `Unhandled event type: ${eventType}` };
});
exports.CheckrService = {
    createCandidate,
    createInvitation,
    getInvitation,
    getReport,
    initiateBackgroundCheckForUser,
    startPreSignupScreening,
    getBackgroundCheckStatusFromDB,
    processWebhookEvent,
};
