# MARKIPIE background face index worker

This worker uses the native TensorFlow.js Node backend instead of running the full indexing loop inside the admin browser. It reads protected Drive thumbnails, generates the same 128-dimensional descriptors, and writes them to the existing Supabase face index tables.

## Required GitHub Actions secret

In **Settings → Secrets and variables → Actions**, add:

- `MARKIPIE_SUPABASE_SERVICE_ROLE_KEY`: the service-role/secret key for the MARKIPIE Supabase project. Never expose this key in frontend code or commit it.

The workflow reuses the existing `VITE_SUPABASE_URL` repository variable for the project URL. The worker checks for unindexed photos every five minutes and can also be dispatched for a specific event.

## Required Supabase Edge Function secret for immediate dispatch

Set `GITHUB_FACE_INDEX_TOKEN` in the Supabase Edge Function secrets for `drive`. Use a GitHub fine-grained token scoped only to repository `adi049/mark` with **Actions: Read and write** permission. The token is used server-side only to dispatch `.github/workflows/face-index.yml` after a Drive import/sync or when the admin presses **Start Face Index**.

After adding that secret, redeploy the `drive` Edge Function. Do not put the token in a `VITE_` variable or frontend source.

## Run manually

Open **GitHub → Actions → MARKIPIE Face Index Worker → Run workflow**. Optionally supply an event UUID. Leave it blank to process all active events with face scan enabled.

The worker skips photos already recorded in `face_index_state`; failed photos are not marked indexed and will be retried on a later run.

## Performance

The worker uses native TensorFlow bindings and a small bounded worker pool. Throughput depends on GitHub runner CPU, image download latency, and how many faces each image contains. Benchmark a real event before promising a fixed processing time.
