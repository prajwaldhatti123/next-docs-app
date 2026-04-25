This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## GCS Storage Setup

This app stores docs in Google Cloud Storage under object keys like `content/<stream>/...`.

### 1) Create bucket

```bash
export GCP_PROJECT_ID="your-project-id"
export GCS_BUCKET="your-docs-bucket"

gcloud config set project "$GCP_PROJECT_ID"
gcloud storage buckets create "gs://$GCS_BUCKET" --location=ASIA-SOUTH1
```

Use the region that matches your deployment.

### 2) Create service account and grant minimal permissions

```bash
export GCS_SA_NAME="docs-gcs-app"
export GCS_SA_EMAIL="$GCS_SA_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create "$GCS_SA_NAME" \
  --display-name="Docs App GCS Access"

gcloud storage buckets add-iam-policy-binding "gs://$GCS_BUCKET" \
  --member="serviceAccount:$GCS_SA_EMAIL" \
  --role="roles/storage.objectAdmin"
```

`roles/storage.objectAdmin` is enough for `list/get/create/delete` object operations used by the app.

### 3) Configure Workload Identity Federation (keyless, Vercel recommended)

In GCP Console:
- Go to **IAM & Admin → Workload Identity Federation**
- Create a pool (for example, ID `vercel`)
- Add OIDC provider (for example, ID `vercel`)
  - Issuer URL:
    - Team mode: `https://oidc.vercel.com/<your-team-slug>`
    - Global mode: `https://oidc.vercel.com`
  - Allowed audience: `https://vercel.com/<your-team-slug>`
- Attribute mapping:
  - `google.subject = assertion.sub`

Then grant service account impersonation to your Vercel subject principal:

`principal://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL_ID>/subject/owner:<TEAM_SLUG>:project:<VERCEL_PROJECT_NAME>:environment:production`

Grant that principal `roles/iam.workloadIdentityUser` on your service account.

### 4) Vercel environment variables (keyless)

Set these in your Vercel project:

```bash
GCS_BUCKET=your-docs-bucket
GCP_PROJECT_ID=your-project-id
GCP_PROJECT_NUMBER=123456789012
GCP_SERVICE_ACCOUNT_EMAIL=docs-gcs-app@your-project-id.iam.gserviceaccount.com
GCP_WORKLOAD_IDENTITY_POOL_ID=vercel
GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel
```

### 5) Local development options

For local development, you can either:
- use `gcloud auth application-default login` (ADC), or
- use a service account key only in local `.env.local` if org policy allows.

Local fallback env vars:

```bash
GCS_BUCKET=your-docs-bucket
GCS_PROJECT_ID=your-project-id
GCS_CLIENT_EMAIL=docs-gcs-app@your-project-id.iam.gserviceaccount.com
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 6) Quick verification

After setting env vars:

```bash
npm run build
npm run dev
```

Then verify in the app:
- create/edit/delete a document
- create/delete a folder
- create/delete a stream
