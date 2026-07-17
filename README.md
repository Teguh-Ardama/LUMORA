# LUMORA

LUMORA is an enterprise-grade, real-time photobooth operating system designed for modern events. It features a complete workflow from photo capture (via Webcams or DSLR) to composition, rendering, and delivery, all backed by a high-performance background processing engine.

## Features

- **Multi-Interface Architecture:**
  - **Operator UI**: A control panel for photobooth operators to supervise sessions, adjust filters, add stickers, and trigger manual actions.
  - **Kiosk UI**: A self-service interface for guests to capture photos, choose layouts, and apply filters.
  - **Display UI**: A real-time slideshow or live view for external monitors.
- **Advanced Image Composition**: Powered by `sharp` and a dedicated background worker, allowing non-blocking high-quality image rendering, layout processing (strips, grids), and real-time filter previews (Grayscale, Vintage, Sepia, etc.).
- **Hardware Integration**: Includes an Electron-based bridge (`apps/bridge`) for syncing DSLR photos and communicating with local printers.
- **Offline Reliability**: Upload queues and offline support ensure that photo sessions continue seamlessly even with spotty internet connectivity.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router), React, Tailwind CSS, Framer Motion
- **Monorepo**: [Turborepo](https://turbo.build/)
- **Database**: PostgreSQL (via [Prisma ORM](https://www.prisma.io/))
- **Caching & Queues**: Redis & [BullMQ](https://docs.bullmq.io/)
- **Image Processing**: [Sharp](https://sharp.pixelplumbing.com/)
- **Real-time**: Socket.IO for cross-interface event synchronization
- **Storage**: S3-compatible API (MinIO for local development)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [pnpm](https://pnpm.io/) (v9+)
- [Docker](https://www.docker.com/) & Docker Compose

### 1. Start Infrastructure

LUMORA uses Docker to spin up PostgreSQL, Redis, and MinIO.

```bash
docker compose up -d
```

### 2. Environment Variables

Copy the `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```
Ensure the `DATABASE_URL` and `REDIS_URL` match your Docker setup.

### 3. Install Dependencies & Setup Database

```bash
pnpm install
pnpm db:push
pnpm --filter @lumora/db run db:generate
pnpm db:seed
```

### 4. Run the Development Servers

Start the Next.js web application and the background worker simultaneously in one terminal:

```bash
pnpm dev
```
- **Web Application** (Admin/Operator/Kiosk): `http://localhost:3000`
- **Worker**: Runs in the background to process image composition and queues.

*Alternatively, you can run them separately:*
```bash
# Run web only
pnpm --filter @lumora/web dev

# Run worker only
pnpm --filter @lumora/worker dev
```

### 5. Start LUMORA Bridge (Desktop App)

To use the DSLR integration and auto-printing, you must run the Lumora Bridge Electron app. Open a **new terminal window**, navigate to the project root, and run:

```bash
pnpm --filter @lumora/bridge dev
```

### 6. DSLR & Bridge Workflow

1. **Local Tether Folder (Input):** The Lumora Bridge app watches a local folder on your computer. Configure your DSLR tethering software (like EOS Utility) to auto-download photos directly into this folder. Click "Choose Tether…" in the Bridge UI to select it.
2. **Raw Uploads & Temporary Storage:** When the DSLR shoots, Bridge detects the file, compresses it locally, and uploads it to S3 (MinIO) as temporary high-res storage.
3. **Session Linking:** If there is an active session running in the Operator Console, the photo is linked to it. If not, it is sent to the "Quarantine Inbox" for manual matching.
4. **Composing:** Once 4 photos are captured, the `@lumora/worker` running in the cloud pulls the 4 raw photos, stitches them into a final layout with borders/filters, and saves the masterpiece back to S3. This composition is what guests see in the Web Gallery.
5. **Output Folder (Auto Download):** Bridge will automatically download the final composed 4R photo back to your computer. Click "Choose Output…" in the Bridge UI to select the folder where the DNP Printer is watching to print automatically.

## Workspaces

LUMORA is structured as a monorepo with the following packages:

- `apps/web`: The main Next.js application containing all user and operator interfaces.
- `apps/worker`: The BullMQ worker responsible for heavy image processing and background tasks.
- `apps/bridge`: The Electron app for local DSLR hardware and printer integration.
- `packages/contracts`: Shared Zod schemas and TypeScript types.
- `packages/db`: Prisma database schema, migrations, and seed scripts.
- `packages/image`: Core image manipulation logic (`sharp` pipelines).
- `packages/core`: Shared utilities and constants.

## License

Private and Confidential. All rights reserved.
