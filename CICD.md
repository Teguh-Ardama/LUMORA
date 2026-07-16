# CI/CD — LUMORA

## 1. Alur branch & PR (rekap konvensi yang sudah disepakati)

- Tidak ada commit langsung ke `main`. Semua perubahan lewat branch (`fitur/nama-perubahan`) → PR.
- Branch protection di `main`: wajib minimal 1 review approval + semua required status checks hijau.
- Required checks: `lint`, `typecheck`, `test`, `build`.

## 2. Workflow: PR checks (`.github/workflows/pr-checks.yml`)

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]

jobs:
  checks:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: lumora_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Audit dependencies
        run: pnpm audit --audit-level=high

      - name: Lint
        run: pnpm turbo run lint

      - name: Typecheck
        run: pnpm turbo run typecheck

      - name: Prisma migrate (test db)
        run: pnpm --filter db prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/lumora_test

      - name: Test
        run: pnpm turbo run test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/lumora_test
          REDIS_URL: redis://localhost:6379

      - name: Build
        run: pnpm turbo run build
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

Catatan: `TURBO_TOKEN`/`TURBO_TEAM` opsional — dipakai kalau mengaktifkan Turborepo remote caching
(mempercepat build signifikan di CI, sangat direkomendasikan untuk monorepo ini).

## 3. Workflow: deploy setelah merge ke `main` (`.github/workflows/deploy.yml`)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Run migration deploy (staging/production DB)
        run: pnpm --filter db prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}

  deploy-web:
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Sesuaikan step ini dengan platform hosting web yang dipilih
      # (mis. Vercel deploy action, atau build+push Docker image)
      - name: Deploy apps/web
        run: echo "TODO: sesuaikan dengan target hosting (Vercel/Docker)"

  deploy-worker:
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build & push worker image
        run: echo "TODO: docker build -f apps/worker/Dockerfile . && push ke registry"
```

## 4. Workflow: build Desktop Bridge (trigger saat tag rilis)

```yaml
name: Build Desktop Bridge

on:
  push:
    tags: ["bridge-v*"]

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Build Tauri app
        run: pnpm --filter desktop-bridge tauri build
      - uses: actions/upload-artifact@v4
        with:
          name: desktop-bridge-${{ matrix.os }}
          path: apps/desktop-bridge/src-tauri/target/release/bundle/**
```

Matrix build diperlukan karena operator memakai laptop dengan OS bervariasi (Windows paling umum
di lapangan, tapi tetap siapkan macOS/Linux untuk operator yang pakai device lain).

## 5. Secrets yang perlu disiapkan di GitHub repo settings

| Secret | Kegunaan |
|---|---|
| `PROD_DATABASE_URL` | Migration deploy ke DB production |
| `TURBO_TOKEN` / `TURBO_TEAM` | Remote caching Turborepo (opsional tapi disarankan) |
| Kredensial hosting web (mis. `VERCEL_TOKEN`) | Deploy `apps/web` |
| Kredensial registry Docker | Push image `apps/worker` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` production | Kalau storage production beda dari MinIO lokal |

## 6. Environment terpisah

- **dev**: docker-compose lokal (postgres, redis, minio) — dijalankan developer sendiri.
- **staging**: mirror production, dipakai untuk smoke test sebelum tag rilis besar (mis. sebelum
  event nyata pertama pakai versi baru).
- **production**: kredensial dan secret terpisah total dari staging — jangan reuse `JWT_SECRET`,
  `BRIDGE_TOKEN_SECRET`, atau DB yang sama (lihat `docs/SECURITY.md` §8).
