import "server-only";
import { Storage } from "@google-cloud/storage";
import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient } from "google-auth-library";

export interface StorageBlob {
  pathname: string;
}

interface ListObjectsResult {
  blobs: StorageBlob[];
  cursor?: string;
}

function createStorageClient(): Storage {
  // Preferred in Vercel: keyless auth via Workload Identity Federation.
  const isVercelRuntime =
    process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
  const gcpProjectId = process.env.GCP_PROJECT_ID;
  const gcpProjectNumber = process.env.GCP_PROJECT_NUMBER;
  const gcpServiceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  const gcpPoolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
  const gcpProviderId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;

  if (
    isVercelRuntime &&
    gcpProjectId &&
    gcpProjectNumber &&
    gcpServiceAccountEmail &&
    gcpPoolId &&
    gcpProviderId
  ) {
    const authClient = ExternalAccountClient.fromJSON({
      type: "external_account",
      audience: `//iam.googleapis.com/projects/${gcpProjectNumber}/locations/global/workloadIdentityPools/${gcpPoolId}/providers/${gcpProviderId}`,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${gcpServiceAccountEmail}:generateAccessToken`,
      subject_token_supplier: {
        getSubjectToken: async () => getVercelOidcToken(),
      },
    });
    if (!authClient) {
      throw new Error("Failed to initialize external account auth client.");
    }
    // @google-cloud/storage bundles a different google-auth-library version than
    // the root dependency; ExternalAccountClient is compatible at runtime.
    return new Storage({
      projectId: gcpProjectId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Storage authClient type mismatch across nested google-auth-library copies
      authClient: authClient as any,
    });
  }

  // Fallback for local/dev or non-federated environments.
  const projectId = process.env.GCS_PROJECT_ID;
  const clientEmail = process.env.GCS_CLIENT_EMAIL;
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  return new Storage({
    projectId,
    ...(clientEmail && privateKey
      ? {
          credentials: {
            client_email: clientEmail,
            private_key: privateKey,
          },
        }
      : {}),
  });
}

const storage = createStorageClient();

function getBucket() {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) {
    throw new Error("Missing GCS_BUCKET environment variable.");
  }
  return storage.bucket(bucketName);
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "");
}

function toBlob(pathname: string): StorageBlob {
  return { pathname };
}

export async function listObjects(
  prefix: string,
  cursor?: string,
): Promise<ListObjectsResult> {
  const bucket = getBucket();
  const [files, nextQuery] = await bucket.getFiles({
    prefix: normalizePath(prefix),
    autoPaginate: false,
    pageToken: cursor,
  });

  return {
    blobs: files.map((file) => toBlob(file.name)),
    cursor: nextQuery?.pageToken,
  };
}

export async function putObject(
  path: string,
  content: string,
  contentType = "text/plain; charset=utf-8",
): Promise<void> {
  const bucket = getBucket();
  const file = bucket.file(normalizePath(path));
  await file.save(content, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: "no-cache",
    },
  });
}

export async function readObjectText(path: string): Promise<string | null> {
  try {
    const bucket = getBucket();
    const file = bucket.file(normalizePath(path));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buffer] = await file.download();
    return buffer.toString("utf-8");
  } catch {
    return null;
  }
}

export async function deleteObjects(paths: string[]): Promise<void> {
  const bucket = getBucket();
  await Promise.all(
    paths.map(async (path) => {
      const file = bucket.file(normalizePath(path));
      await file.delete({ ignoreNotFound: true });
    }),
  );
}

export async function deleteObject(path: string): Promise<void> {
  await deleteObjects([path]);
}
