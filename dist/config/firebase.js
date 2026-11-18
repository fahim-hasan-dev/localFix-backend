"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseAdmin = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const _1 = __importDefault(require("."));
function serviceAccountFromEnv() {
    var _a;
    const encoded = (_a = _1.default.firebase.serviceAccountBase64) === null || _a === void 0 ? void 0 : _a.replace(/\s/g, "");
    if (!encoded) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set");
    }
    let parsed;
    try {
        parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    }
    catch (_b) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64 JSON");
    }
    const account = parsed;
    const projectId = account.projectId || account.project_id;
    const clientEmail = account.clientEmail || account.client_email;
    const privateKey = (account.privateKey || account.private_key || "").replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Decoded Firebase service account is missing project_id, client_email, or private_key");
    }
    return { projectId, clientEmail, privateKey };
}
if (!firebase_admin_1.default.apps.length) {
    firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert(serviceAccountFromEnv()),
    });
}
exports.firebaseAdmin = firebase_admin_1.default;
