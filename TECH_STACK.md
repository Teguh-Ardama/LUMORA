# LUMORA Tech Stack

LUMORA is an Enterprise Operator-Assisted Photobooth Platform built as a monorepo. Below is the detailed breakdown of the technologies, frameworks, and tools used across the project.

## 🏗️ Architecture & Tooling

*   **Monorepo Management:** [Turborepo](https://turbo.build/repo)
*   **Package Manager:** [pnpm](https://pnpm.io/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Runtime Engine:** Node.js (v20+)

## 🌐 Web Application (`apps/web`)

The frontend and API layer of LUMORA, built for high performance and modern web standards.

*   **Core Framework:** [Next.js 15](https://nextjs.org/) (App Router)
*   **UI Library:** [React 19](https://react.dev/)
*   **API Framework:** [Hono](https://hono.dev/) (Integrated within Next.js API routes)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Animations:** [Framer Motion](https://www.framer.com/motion/) & `tailwindcss-animate`
*   **Data Fetching & State:** [TanStack React Query](https://tanstack.com/query/latest)
*   **Form Management:** [React Hook Form](https://react-hook-form.com/)
*   **Validation:** [Zod](https://zod.dev/) (with `@hono/zod-validator` & `@hookform/resolvers`)
*   **Data Visualization:** [Recharts](https://recharts.org/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Utilities:** `date-fns` (Date manipulation), `sharp` (Image processing), `qrcode` (QR generation)

## ⚙️ Background Worker (`apps/worker`)

A dedicated worker service for handling asynchronous and heavy background tasks.

*   **Execution:** Node.js via `tsx`
*   **Job Queue / Background Processing:** [BullMQ](https://docs.bullmq.io/) (Powered by Redis)
*   **Email Sending:** [Nodemailer](https://nodemailer.com/)

## 🗄️ Database & ORM (`packages/db`)

Centralized database schemas, migrations, and access layer.

*   **ORM:** [Prisma](https://www.prisma.io/) (v6)
*   **Security:** `bcryptjs` (Password hashing)

## 🐳 Infrastructure & Services (`docker-compose.yml`)

The underlying services required to run LUMORA locally and in production.

*   **Relational Database:** [PostgreSQL 16](https://www.postgresql.org/) (Alpine)
*   **In-Memory Store / Message Broker:** [Redis 7](https://redis.io/) (Alpine) - Used for BullMQ and potential caching mechanisms.
