# harness-demo-app

A zero-dependency Node.js app for a small Harness CI demo. It has no npm
dependencies, so a pipeline only needs Node and `npm test`.

Ported from the `demo-app/` directory of `harness-101` and published as its own
repository so it can be attached to a Harness GitHub connector directly.

## Run locally

```bash
node server.js
```

Then:

```bash
curl localhost:3000/health
curl localhost:3000/api/hello
curl localhost:3000/metrics
curl localhost:3000/flags
```

`PORT`, `APP_VERSION`, `FAULT_RATE`, `FAULT_LATENCY_MS`, `FLAG_FILE`, and
`FF_GREETING_V2` are optional environment variables used by the wider demo.

## Test

```bash
npm test
```

The suite starts the server on an ephemeral port, checks the health, greeting,
feature-flag, metrics, and 404 behavior, and exits non-zero on failure.

## Use it from Harness CI

1. Add a **GitHub** connector pointing at this repository.
2. Create a Harness project (for example `demo`).
3. Create a **CI** pipeline with a **Build** stage.
4. Use **Harness Cloud** infrastructure so no delegate or local container runtime
   is required.
5. Add a **Run** step with shell `Sh` and command:

   ```sh
   npm install && npm test
   ```

6. Run the pipeline and check the step log. `npm install` is effectively a no-op
   because `package.json` has no dependencies.

This covers real CI execution (clone, test, logs, history). Deployment, canary
verification, security policy gates, FME, and CCM need the corresponding Harness
modules, connectors, and a target environment; they are not part of this repo.

## Docker (optional)

The included `Dockerfile` builds a small runtime image. It is not needed for the
CI demo above.

```bash
docker build -t harness-demo-app .
docker run --rm -p 3000:3000 harness-demo-app
```
