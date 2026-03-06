# Polaris — GCP Cloud Run Deployment

## Prerequisites

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed
2. A GCP project with billing enabled (credits work)
3. Your `GEMINI_API_KEY` handy

## Steps

### 1. Authenticate and set project

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable required APIs (one-time)

```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
```

### 3. Deploy (one command)

From the repo root (where the `Dockerfile` is):

```bash
gcloud run deploy polaris \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 1 \
  --max-instances 3 \
  --set-env-vars "GEMINI_API_KEY=your-key-here,HF_TOKEN=your-huggingface-token-here"
```

**What this does:**
- Builds the Docker image in Cloud Build (no local Docker needed)
- Pushes to Artifact Registry
- Deploys to Cloud Run
- `--memory 4Gi` — enough for spaCy + RoBERTa + GloVe loaded simultaneously
- `--min-instances 1` — keeps one instance warm so demo day has no cold start
- `--allow-unauthenticated` — public URL, no login needed
- `--timeout 300` — 5 min request timeout for long SSE streams

### 4. Get your URL

After deploy completes, you'll see:

```
Service URL: https://polaris-xxxxx-uc.a.run.app
```

The slide deck is at `https://polaris-xxxxx-uc.a.run.app/#slides`

## Cost estimate (with credits)

- **Idle with min-instances=1:** ~$0.50/day
- **During demo/usage:** pennies per request
- **Build:** ~$0.10 per build (Cloud Build)
- **Total for a week of demo prep:** ~$5-10

## Updating after changes

Just re-run the deploy command:

```bash
gcloud run deploy polaris \
  --source . \
  --region us-central1
```

It remembers previous settings. Takes ~3-5 min to build and deploy.

## Optional: Set min-instances to 0 after demo

To stop paying for idle:

```bash
gcloud run services update polaris \
  --region us-central1 \
  --min-instances 0
```

## Troubleshooting

**OOM (out of memory):** Bump to `--memory 8Gi` if 4Gi isn't enough.

**Cold start slow:** The Dockerfile pre-downloads all ML models at build time, so cold starts should be ~10-15s (just model loading into RAM). Keep `--min-instances 1` for demo day.

**SSE streaming cuts off:** Increase `--timeout` to 600 (10 min).

**Build fails:** Make sure you're running from the repo root where `Dockerfile` lives. Check `gcloud builds log` for details.
