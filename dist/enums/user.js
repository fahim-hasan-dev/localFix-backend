"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHECKR_INVITATION_STATUS = exports.CHECKR_VERIFICATION_STATUS = exports.APPROVAL_STATUS = exports.STATUS = exports.GENDER = exports.USER_ROLES = void 0;
var USER_ROLES;
(function (USER_ROLES) {
    USER_ROLES["ADMIN"] = "admin";
    USER_ROLES["SUPER_ADMIN"] = "super_admin";
    USER_ROLES["HOME_OWNER"] = "home_owner";
    USER_ROLES["PROFESSIONAL"] = "professional";
})(USER_ROLES || (exports.USER_ROLES = USER_ROLES = {}));
var GENDER;
(function (GENDER) {
    GENDER["MALE"] = "male";
    GENDER["FEMALE"] = "female";
    GENDER["OTHER"] = "other";
})(GENDER || (exports.GENDER = GENDER = {}));
var STATUS;
(function (STATUS) {
    STATUS["ACTIVE"] = "active";
    STATUS["INACTIVE"] = "inactive";
    STATUS["BANNED"] = "banned";
})(STATUS || (exports.STATUS = STATUS = {}));
var APPROVAL_STATUS;
(function (APPROVAL_STATUS) {
    APPROVAL_STATUS["PENDING"] = "pending";
    APPROVAL_STATUS["APPROVED"] = "approved";
    APPROVAL_STATUS["REJECTED"] = "rejected";
})(APPROVAL_STATUS || (exports.APPROVAL_STATUS = APPROVAL_STATUS = {}));
var CHECKR_VERIFICATION_STATUS;
(function (CHECKR_VERIFICATION_STATUS) {
    CHECKR_VERIFICATION_STATUS["NOT_STARTED"] = "not_started";
    CHECKR_VERIFICATION_STATUS["PENDING"] = "pending";
    CHECKR_VERIFICATION_STATUS["VERIFIED"] = "verified";
    CHECKR_VERIFICATION_STATUS["REVIEW_REQUIRED"] = "review_required";
    CHECKR_VERIFICATION_STATUS["FAILED"] = "failed";
})(CHECKR_VERIFICATION_STATUS || (exports.CHECKR_VERIFICATION_STATUS = CHECKR_VERIFICATION_STATUS = {}));
var CHECKR_INVITATION_STATUS;
(function (CHECKR_INVITATION_STATUS) {
    CHECKR_INVITATION_STATUS["NOT_SENT"] = "not_sent";
    CHECKR_INVITATION_STATUS["PENDING"] = "pending";
    CHECKR_INVITATION_STATUS["COMPLETED"] = "completed";
    CHECKR_INVITATION_STATUS["EXPIRED"] = "expired";
})(CHECKR_INVITATION_STATUS || (exports.CHECKR_INVITATION_STATUS = CHECKR_INVITATION_STATUS = {}));
