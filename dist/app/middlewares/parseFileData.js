"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFileData = void 0;
const fileMapper_1 = require("./fileMapper");
const ApiErrors_1 = __importDefault(require("../../errors/ApiErrors"));
// normalizer
const normalizeField = (field) => {
    var _a;
    if (typeof field === "string") {
        return { fieldName: field, mode: "auto" };
    }
    return {
        fieldName: field.fieldName,
        mode: (_a = field.mode) !== null && _a !== void 0 ? _a : "auto",
    };
};
// safe json parse (FIXED)
const safeJsonParse = (value) => {
    if (typeof value !== "string")
        return value;
    try {
        return JSON.parse(value);
    }
    catch (_a) {
        throw new ApiErrors_1.default(400, "Invalid JSON in body.data");
    }
};
// auto mode resolver
const resolveMode = (mode, fieldName, files) => {
    if (mode !== "auto")
        return mode;
    if (fieldName === "images" ||
        fieldName === "propertyPhotos" ||
        fieldName === "floorPlanPhotos" ||
        fieldName === "flatPhotos" ||
        fieldName === "otherDocuments" ||
        fieldName === "documents" ||
        fieldName === "inspectionPhotos" ||
        fieldName === "itemPhotos" ||
        fieldName === "projectPhotos") {
        return "multiple";
    }
    return files && files.length <= 1 ? "single" : "multiple";
};
// main middleware
const parseFileData = (...fields) => {
    const normalized = fields.map(normalizeField);
    return (req, res, next) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        try {
            const files = (req.files || {});
            const fileData = {};
            let parsedBody = {};
            if ((_a = req.body) === null || _a === void 0 ? void 0 : _a.data) {
                parsedBody = safeJsonParse(req.body.data);
            }
            // Parse JSON string fields in req.body or parsedBody if sent as form-data
            const jsonFieldsToParse = [
                "council",
                "parking",
                "compliance",
                "floorPlanPhotos",
                "flatPhotos",
                "houseRules",
                "otherDocuments",
                "documents",
                "titles",
                "key",
                "gas",
                "electricity",
                "water",
                "wifi",
                "safetyAlarms",
                "appliances",
                "roomChecklist",
                "tradeLicense",
                "liabilityInsurance",
                "businessHours",
                "acceptedPayments",
                "projectPhotos",
                "location",
            ];
            for (const f of jsonFieldsToParse) {
                if (typeof ((_b = req.body) === null || _b === void 0 ? void 0 : _b[f]) === "string") {
                    try {
                        req.body[f] = JSON.parse(req.body[f]);
                    }
                    catch (_q) {
                        // Keep original string if not valid JSON
                    }
                }
                if (typeof parsedBody[f] === "string") {
                    try {
                        parsedBody[f] = JSON.parse(parsedBody[f]);
                    }
                    catch (_r) {
                        // Keep original string
                    }
                }
            }
            // Alias image -> images if images is not explicitly set in parsedBody or req.body
            if (parsedBody.image !== undefined && parsedBody.images === undefined) {
                parsedBody.images = parsedBody.image;
            }
            if (((_c = req.body) === null || _c === void 0 ? void 0 : _c.image) !== undefined && ((_d = req.body) === null || _d === void 0 ? void 0 : _d.images) === undefined) {
                req.body.images = req.body.image;
            }
            const effectiveNormalized = normalized.length > 0
                ? normalized
                : Object.keys(files).map((name) => ({
                    fieldName: name,
                    mode: "auto",
                }));
            for (const { fieldName, mode } of effectiveNormalized) {
                let fieldFiles = files[fieldName];
                // Fallback for image / images field name mismatch
                if ((!fieldFiles || fieldFiles.length === 0) &&
                    fieldName === "images") {
                    fieldFiles = files["image"];
                }
                if ((!fieldFiles || fieldFiles.length === 0) && fieldName === "image") {
                    fieldFiles = files["images"];
                }
                // Fallback for documentFront / nidFrontPic
                if ((!fieldFiles || fieldFiles.length === 0) &&
                    fieldName === "documentFront") {
                    fieldFiles = files["nidFrontPic"];
                }
                if ((!fieldFiles || fieldFiles.length === 0) &&
                    fieldName === "documentBack") {
                    fieldFiles = files["nidBackPic"];
                }
                if (!fieldFiles || fieldFiles.length === 0)
                    continue;
                const resolvedMode = resolveMode(mode, fieldName, fieldFiles);
                const targetFolder = files[fieldName]
                    ? fieldName
                    : fieldName === "images"
                        ? "image"
                        : fieldName;
                if (fieldName === "taxDocuments" ||
                    fieldName === "insuranceHub" ||
                    fieldName === "uploadedFiles") {
                    // Special handling for taxDocuments, insuranceHub and uploadedFiles: create array of objects with fileUrl and fileName
                    fileData[fieldName] = fieldFiles.map((file) => ({
                        fileUrl: (0, fileMapper_1.mapFileToUrl)(file, targetFolder),
                        fileName: file.originalname,
                        uploadedAt: new Date(),
                    }));
                }
                else if (resolvedMode === "single") {
                    fileData[fieldName] = (0, fileMapper_1.mapFileToUrl)(fieldFiles[0], targetFolder);
                }
                else {
                    const mapped = (0, fileMapper_1.mapFilesToUrls)(fieldFiles, targetFolder);
                    fileData[fieldName] = Array.isArray(mapped) ? mapped : [mapped];
                }
            }
            // Certificate mapping fallback for compliance updates
            if (fileData.certificate ||
                fileData.certificateUrl ||
                fileData.complianceDocument ||
                fileData.file ||
                fileData.document ||
                fileData.otherDocuments ||
                fileData.documents) {
                fileData.certificateUrl =
                    fileData.certificateUrl ||
                        fileData.certificate ||
                        fileData.complianceDocument ||
                        fileData.file ||
                        fileData.document ||
                        fileData.otherDocuments ||
                        fileData.documents;
            }
            if (!((_e = req.body) === null || _e === void 0 ? void 0 : _e.certificateUrl) &&
                (((_f = req.body) === null || _f === void 0 ? void 0 : _f.otherDocuments) || ((_g = req.body) === null || _g === void 0 ? void 0 : _g.documents))) {
                req.body.certificateUrl = req.body.otherDocuments || req.body.documents;
            }
            // If councilPhoto was uploaded and council object exists
            if (fileData.councilPhoto) {
                if (parsedBody.council && typeof parsedBody.council === "object") {
                    parsedBody.council.councilPhoto = fileData.councilPhoto;
                }
                if (((_h = req.body) === null || _h === void 0 ? void 0 : _h.council) && typeof req.body.council === "object") {
                    req.body.council.councilPhoto = fileData.councilPhoto;
                }
            }
            // If parkingPhoto was uploaded and parking object exists
            if (fileData.parkingPhoto) {
                if (parsedBody.parking && typeof parsedBody.parking === "object") {
                    parsedBody.parking.parkingPhoto = fileData.parkingPhoto;
                }
                if (((_j = req.body) === null || _j === void 0 ? void 0 : _j.parking) && typeof req.body.parking === "object") {
                    req.body.parking.parkingPhoto = fileData.parkingPhoto;
                }
            }
            // Merge taxDocuments data from parsedBody with file data
            if (fileData.taxDocuments && parsedBody.taxDocuments) {
                const taxDocsFromBody = Array.isArray(parsedBody.taxDocuments)
                    ? parsedBody.taxDocuments
                    : [];
                fileData.taxDocuments = fileData.taxDocuments.map((doc, index) => (Object.assign(Object.assign({}, doc), (taxDocsFromBody[index] || {}))));
                // Remove taxDocuments from parsedBody to avoid duplication
                delete parsedBody.taxDocuments;
            }
            // Merge insuranceHub data from parsedBody with file data
            if (fileData.insuranceHub && parsedBody.insuranceHub) {
                const insuranceHubFromBody = Array.isArray(parsedBody.insuranceHub)
                    ? parsedBody.insuranceHub
                    : [];
                fileData.insuranceHub = fileData.insuranceHub.map((doc, index) => (Object.assign(Object.assign({}, doc), (insuranceHubFromBody[index] || {}))));
                // Remove insuranceHub from parsedBody to avoid duplication
                delete parsedBody.insuranceHub;
            }
            // Merge uploadedFiles data from parsedBody with file data
            if (fileData.uploadedFiles && parsedBody.uploadedFiles) {
                const uploadedFilesFromBody = Array.isArray(parsedBody.uploadedFiles)
                    ? parsedBody.uploadedFiles
                    : [];
                fileData.uploadedFiles = fileData.uploadedFiles.map((doc, index) => (Object.assign(Object.assign({}, doc), (uploadedFilesFromBody[index] || {}))));
                // Remove uploadedFiles from parsedBody to avoid duplication
                delete parsedBody.uploadedFiles;
            }
            // Normalize single string images in parsedBody / req.body for multiple mode / images / propertyPhotos / floorPlanPhotos / flatPhotos
            for (const { fieldName, mode } of effectiveNormalized) {
                if (fieldName === "images" ||
                    fieldName === "propertyPhotos" ||
                    fieldName === "floorPlanPhotos" ||
                    fieldName === "flatPhotos" ||
                    fieldName === "otherDocuments" ||
                    fieldName === "documents" ||
                    fieldName === "inspectionPhotos" ||
                    fieldName === "itemPhotos" ||
                    fieldName === "projectPhotos" ||
                    mode === "multiple") {
                    if (typeof parsedBody[fieldName] === "string") {
                        parsedBody[fieldName] = [parsedBody[fieldName]];
                    }
                    if (typeof ((_k = req.body) === null || _k === void 0 ? void 0 : _k[fieldName]) === "string") {
                        req.body[fieldName] = [req.body[fieldName]];
                    }
                }
            }
            // Smart merge string array URLs (e.g. existing images from parsedBody/req.body + newly uploaded files)
            for (const key of Object.keys(fileData)) {
                let existing = (_l = parsedBody[key]) !== null && _l !== void 0 ? _l : (_m = req.body) === null || _m === void 0 ? void 0 : _m[key];
                if (existing !== undefined && existing !== null) {
                    const existingArray = Array.isArray(existing)
                        ? existing
                        : typeof existing === "string"
                            ? [existing]
                            : [];
                    if (Array.isArray(fileData[key])) {
                        const existingUrls = existingArray.filter((url) => typeof url === "string" && url.trim().length > 0);
                        fileData[key] = [...existingUrls, ...fileData[key]];
                    }
                }
            }
            req.body = Object.assign(Object.assign(Object.assign({}, req.body), parsedBody), fileData);
            // If council or parking was wrapped inside req.body.council/parking without top-level propertyName (sub-route update)
            if (((_o = req.body) === null || _o === void 0 ? void 0 : _o.council) &&
                typeof req.body.council === "object" &&
                !req.body.propertyName) {
                req.body = Object.assign(Object.assign({}, req.body.council), req.body);
            }
            if (((_p = req.body) === null || _p === void 0 ? void 0 : _p.parking) &&
                typeof req.body.parking === "object" &&
                !req.body.propertyName) {
                req.body = Object.assign(Object.assign({}, req.body.parking), req.body);
            }
            if (req.body.data) {
                delete req.body.data;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.parseFileData = parseFileData;
