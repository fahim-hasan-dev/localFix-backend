"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOB_TIMEFRAME = exports.JOB_REQUEST_STATUS = void 0;
var JOB_REQUEST_STATUS;
(function (JOB_REQUEST_STATUS) {
    JOB_REQUEST_STATUS["AWAITING_QUOTES"] = "awaiting_quotes";
    JOB_REQUEST_STATUS["QUOTED"] = "quoted";
    JOB_REQUEST_STATUS["IN_PROGRESS"] = "in_progress";
    JOB_REQUEST_STATUS["COMPLETED"] = "completed";
    JOB_REQUEST_STATUS["CANCELLED"] = "cancelled";
})(JOB_REQUEST_STATUS || (exports.JOB_REQUEST_STATUS = JOB_REQUEST_STATUS = {}));
var JOB_TIMEFRAME;
(function (JOB_TIMEFRAME) {
    JOB_TIMEFRAME["ASAP_EMERGENCY"] = "ASAP / Emergency";
    JOB_TIMEFRAME["WITHIN_A_FEW_DAYS"] = "Within a few days";
    JOB_TIMEFRAME["FLEXIBLE"] = "Flexible";
})(JOB_TIMEFRAME || (exports.JOB_TIMEFRAME = JOB_TIMEFRAME = {}));
