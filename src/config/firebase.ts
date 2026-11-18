import admin from "firebase-admin";
import config from ".";

function serviceAccountFromEnv(): admin.ServiceAccount {
  const encoded = config.firebase.serviceAccountBase64?.replace(/\s/g, "");
  if (!encoded) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set");
  }

  let parsed: admin.ServiceAccount;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64 JSON");
  }

  const account = parsed as admin.ServiceAccount & {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  const projectId = account.projectId || account.project_id;
  const clientEmail = account.clientEmail || account.client_email;
  const privateKey = (account.privateKey || account.private_key || "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Decoded Firebase service account is missing project_id, client_email, or private_key");
  }

  return { projectId, clientEmail, privateKey };
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountFromEnv()),
  });
}

export const firebaseAdmin = admin;
