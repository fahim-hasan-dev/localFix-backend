"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseMode = void 0;
const responseMode_1 = require("../constants/responseMode");
exports.responseMode = ((_a = process.env.RESPONSE_MODE) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === responseMode_1.RESPONSE_MODE.SOFT
    ? responseMode_1.RESPONSE_MODE.SOFT
    : responseMode_1.RESPONSE_MODE.STRICT;
console.log("ENV RESPONSE_MODE =", process.env.RESPONSE_MODE);
console.log("RESOLVED MODE =", exports.responseMode);
