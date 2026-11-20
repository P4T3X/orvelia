ORVELIA

Master Technical Implementation Document

Version: 1.0
Project: ORVELIA
Category: Personal Ownership Management Platform
Development strategy: Web-first, mobile-ready
Development tool: Claude Code
Initial market: Peru
Long-term market: International
Brand direction: Luxury Technology

⸻

1. PRODUCT VISION

ORVELIA is a premium personal ownership management platform that helps people organize, protect, track, and manage everything they own.

The platform centralizes purchase receipts, invoices, product information, warranties, return deadlines, maintenance schedules, important documents, and ownership history.

ORVELIA should evolve from a digital ownership organizer into an intelligent personal ownership ecosystem.

Core value proposition

“Everything you own. One intelligent space.”

Main principles

* Simplicity: the product must be immediately understandable.
* Intelligence: AI should automate repetitive work.
* Reliability: important information must be accurate and traceable.
* Privacy: users own and control their information.
* Premium experience: every screen should feel polished and professional.
* Scalability: architecture must support international expansion.

ORVELIA must not become a generic notes application, receipt scanner, or financial dashboard.

Its category is Personal Ownership Management.

2. DEVELOPMENT STRATEGY

Development will happen in three major stages.

Stage 1 — Web Platform

Build a responsive, production-oriented web application using Next.js.

The web platform must work on:

* Desktop computers.
* Laptops.
* Tablets.
* Mobile browsers.

It should support PWA installation where appropriate.

Stage 2 — iOS Application

Build a native mobile experience using React Native and Expo.

Reuse:

* Backend.
* Authentication.
* Database.
* Business logic.
* API contracts.
* Shared TypeScript packages.

Stage 3 — Android Application

Use the same mobile architecture and backend, adapting the interface and integrations to Android.

Do not build separate business logic for each platform.

3. TECHNOLOGY STACK

Frontend

* Next.js using the App Router.
* React.
* TypeScript with strict mode.
* Tailwind CSS.
* shadcn/ui where appropriate.
* Lucide icons.
* Geist or Inter typography.
* React Hook Form.
* Zod validation.
* TanStack Query where server-state management benefits from it.

Backend

* Supabase.
* PostgreSQL.
* Supabase Authentication.
* Supabase Storage.
* Supabase Edge Functions when appropriate.
* Row Level Security on all user-owned data.

AI and document processing

Create a provider-independent AI integration layer.

Responsibilities:

* OCR processing.
* Receipt recognition.
* Structured information extraction.
* Product categorization.
* Document classification.
* AI assistant responses.

Use schema validation for AI-generated output. Never trust extracted data without validation and user confirmation.

Do not hardcode an AI provider into business logic.

Infrastructure

* GitHub for source control.
* Vercel for web deployment.
* Supabase for backend infrastructure.
* Resend for transactional email.
* Sentry for error monitoring.
* Analytics provider selected after evaluating privacy and cost.

Future mobile

* React Native.
* Expo.
* TypeScript.
* Expo Notifications.
* Shared API and domain packages.

4. RECOMMENDED PROJECT STRUCTURE

Use a modular monorepo architecture when the project structure justifies it.

Example:

orvelia/
apps/
web/
mobile/
packages/
ui/
types/
schemas/
api/
domain/
supabase/
migrations/
functions/
seed/
docs/
architecture/
database/
security/
product/
.env.example
package.json
README.md

The initial implementation can start with the web application and shared packages. Do not create unnecessary abstractions before they are needed.

Keep business logic separate from presentation.

5. PRODUCT MODULES

Module 1 — Authentication and User Accounts

Features:

* Sign up.
* Login.
* Logout.
* Password recovery.
* Email verification.
* User profile.
* Account deletion.
* Session management.

Future:

* Social login.
* Passkeys.
* Multi-factor authentication.

Module 2 — ORVELIA HOME

Main dashboard.

Display:

* Total registered products.
* Active warranties.
* Upcoming deadlines.
* Recent activity.
* Pending actions.
* Recent receipts.
* Quick actions.

The dashboard must be personalized to each user.

Module 3 — MY COLLECTION

Central product management.

Each product should support:

* Product name.
* Brand.
* Model.
* Category.
* Description.
* Purchase date.
* Purchase price.
* Currency.
* Store or seller.
* Serial number, optionally.
* Product image.
* Associated receipts.
* Warranty information.
* Documents.
* Notes.
* Status.

Product statuses:

* Active.
* Sold.
* Gifted.
* Archived.
* Disposed.

Users must be able to create, edit, search, filter, archive, and delete their products.

Module 4 — SMART SCANNER

Allow users to upload:

* Photos.
* PDFs.
* Digital receipts.

Processing workflow:

1. User uploads a document.
2. Validate file type and size.
3. Store it privately.
4. Start OCR processing.
5. Extract structured information.
6. Validate the extracted information.
7. Display an editable confirmation screen.
8. Save only after user confirmation.
9. Offer to create a product and relevant reminders.

Extract when available:

* Merchant.
* Purchase date.
* Total amount.
* Currency.
* Tax information.
* Product descriptions.
* Invoice or receipt number.

Never invent missing values.

OCR and AI results must have clear processing states and error handling.

Module 5 — WARRANTIES AND RETURNS

Users can record:

* Warranty start date.
* Warranty end date.
* Warranty provider.
* Coverage information.
* Warranty document.
* Return deadline.
* Return policy details.
* Source of the information.

Important:
Do not automatically assume that all products have a standard warranty or return period.

Distinguish between:

* Information extracted from a document.
* Information entered manually.
* Information confirmed by the user.
* Information that still needs verification.

Module 6 — SMART CALENDAR

Display:

* Warranty expiration.
* Return deadlines.
* Maintenance schedules.
* Custom reminders.
* Document expiration dates.

Include:

* Calendar view.
* Upcoming events.
* Reminder configuration.
* Notification preferences.

Notifications must be generated through reliable scheduled backend processes, not only browser timers.

Module 7 — ORVELIA AI

Create an intelligent assistant that can answer questions about the user’s registered information.

Example questions:

* Which products have active warranties?
* How much did I spend on electronics?
* What deadlines are approaching?
* Show my most recent purchases.
* Which products are missing receipts?
* What maintenance is scheduled?

The assistant must only use information the user is authorized to access.

It must not fabricate product details, warranty conditions, dates, or financial figures.

Provide links to relevant records when possible.

Module 8 — ORVELIA FAMILY

Future module.

Features:

* Family workspace.
* Invitations.
* Shared products.
* Shared documents.
* Member roles.
* Permission management.
* Shared reminders.

Private and shared data must have separate authorization rules.

Module 9 — SUBSCRIPTIONS

Initial plans:

FREE:

* Up to 10 products.
* 3 document scans per month.
* Basic dashboard.
* Basic reminders.

PLUS:

* Unlimited products.
* 30 scans per month.
* Advanced organization.
* More storage.

ULTRA:

* 100 scans per month.
* Advanced AI.
* Family features when available.
* Expanded storage.

All limits must be configurable on the backend.

Do not trust frontend subscription state as the source of truth.

Subscription status must be verified through payment-provider webhooks.

6. DATABASE DESIGN

Use PostgreSQL with UUID primary keys, timestamps, appropriate indexes, and foreign keys.

Recommended initial tables:

profiles

* id
* full_name
* avatar_url
* preferred_language
* preferred_currency
* timezone
* created_at
* updated_at

products

* id
* user_id
* name
* brand
* model
* category_id
* description
* purchase_date
* purchase_price
* currency
* seller
* serial_number
* image_path
* status
* created_at
* updated_at

categories

* id
* user_id (nullable for system categories)
* name
* icon
* created_at

receipts

* id
* user_id
* product_id
* merchant
* receipt_number
* purchase_date
* total_amount
* currency
* storage_path
* processing_status
* created_at

documents

* id
* user_id
* product_id
* document_type
* title
* storage_path
* metadata
* created_at

warranties

* id
* user_id
* product_id
* provider
* start_date
* end_date
* coverage_description
* source_document_id
* verification_status
* created_at

return_deadlines

* id
* user_id
* product_id
* deadline_date
* policy_details
* source_document_id
* verification_status
* created_at

reminders

* id
* user_id
* product_id
* title
* description
* scheduled_at
* status
* notification_channels
* created_at

subscriptions

* id
* user_id
* provider
* provider_customer_id
* provider_subscription_id
* plan
* status
* current_period_start
* current_period_end
* created_at

ai_usage

* id
* user_id
* operation
* units
* provider
* status
* created_at

Future tables:

* families
* family_members
* invitations
* shared_resources
* activity_logs
* notification_preferences

Database design must be reviewed before migrations are applied.

Never store passwords directly.

7. SECURITY AND PRIVACY

Security is mandatory from the first implementation.

Requirements:

* Row Level Security on every user-owned table.
* Verify ownership on every server-side operation.
* Private document storage.
* Signed URLs with short expiration periods.
* Server-side secret management.
* Strict input validation.
* Upload file type and size validation.
* Rate limiting for sensitive endpoints.
* Protection against unauthorized access.
* Secure authentication and session handling.
* Audit important security events.
* Data export and deletion capabilities.
* Backup and recovery strategy.

Do not expose service-role keys in browser code.

Do not store full payment card information.

Implement privacy controls appropriate to Peruvian personal data protection requirements and the markets where ORVELIA eventually operates.

8. DESIGN SYSTEM

Brand: ORVELIA.

Visual direction: Luxury Technology.

Colors

* Graphite Black: #111315
* Deep Charcoal: #1A1D20
* Warm Ivory: #F6F4EF
* Champagne Gold: #C7A66A
* Muted Silver: #B7BBC0
* Soft Gray: #858B92

Use gold as a restrained accent, not as a dominant color.

Typography

* Geist or Inter.
* Clear typographic hierarchy.
* Strong spacing.
* Excellent readability.

UI principles

* Minimalist.
* Premium.
* Elegant.
* Consistent.
* Responsive.
* Accessible.
* Fast.

Use:

* Subtle transitions.
* Smooth navigation.
* Refined hover states.
* Carefully designed loading states.
* Skeleton loaders.
* Useful empty states.
* Clear error messages.
* Toast notifications.
* Responsive tables and cards.

Avoid:

* Excessive gradients.
* Unnecessary animations.
* Oversized typography.
* Excessive shadows.
* Generic AI-generated dashboard layouts.
* Cluttered interfaces.

Support light and dark themes.

The experience should feel like a mature international technology product.

9. APPLICATION ROUTES

Public:

* /
* /features
* /pricing
* /about
* /privacy
* /terms

Authentication:

* /login
* /register
* /forgot-password

Authenticated:

* /app
* /app/products
* /app/products/new
* /app/products/[id]
* /app/scanner
* /app/documents
* /app/calendar
* /app/assistant
* /app/settings
* /app/billing

Enforce authentication and authorization on the server.

10. DEVELOPMENT ROADMAP

PHASE 0 — REPOSITORY AUDIT AND FOUNDATION

* Inspect existing repository.
* Identify existing technology.
* Document architecture.
* Configure development environment.
* Establish design system.
* Define database migrations.
* Configure Git and environment variables.

PHASE 1 — BRAND AND WEB FOUNDATION

* Landing page.
* Responsive layout.
* Navigation.
* Authentication.
* Dashboard shell.
* Design components.

PHASE 2 — OWNERSHIP MANAGEMENT

* Product CRUD.
* Categories.
* Search.
* Filtering.
* Product detail pages.
* Product images.

PHASE 3 — DOCUMENT INTELLIGENCE

* Private uploads.
* OCR integration.
* Structured extraction.
* Confirmation workflow.
* Receipt and document association.

PHASE 4 — AUTOMATION

* Warranties.
* Returns.
* Calendar.
* Reminders.
* Notifications.

PHASE 5 — ORVELIA AI

* AI service abstraction.
* Context retrieval.
* Authorized data access.
* Structured responses.
* Usage tracking.

PHASE 6 — MONETIZATION

* Free plan.
* Plus plan.
* Ultra plan.
* Payment integration.
* Webhooks.
* Usage limits.
* Subscription management.

PHASE 7 — FAMILY AND ADVANCED FEATURES

* Family workspaces.
* Invitations.
* Roles.
* Shared assets.
* Advanced analytics.

PHASE 8 — PRODUCTION

* Security review.
* Performance testing.
* Accessibility.
* Backups.
* Monitoring.
* Deployment.
* Beta testing.
* Public launch.

PHASE 9 — MOBILE

* Shared domain and API packages.
* React Native application.
* iOS testing.
* Android testing.
* Push notifications.
* Store submission.

11. QUALITY REQUIREMENTS

Every feature must have:

* Defined acceptance criteria.
* Loading states.
* Empty states.
* Error states.
* Validation.
* Authorization.
* Responsive behavior.
* Tests where appropriate.

Do not mark a feature complete merely because its interface exists.

A feature is complete only when its backend behavior, security, validation, and user experience work.

Never use fake data in production.

Use clearly labeled seed data only in development.

Do not simulate successful payments, uploads, OCR, or AI operations in production.

12. BUSINESS AND PRODUCT METRICS

Track:

* Registrations.
* Activation rate.
* Products created.
* Documents scanned.
* Successful extraction rate.
* Reminder engagement.
* Subscription conversion.
* Monthly recurring revenue.
* Retention.
* AI cost per active user.
* Infrastructure cost per active user.

Initial validation goals:

* 100 beta users.
* 500 initial public users.
* 60% activation target.
* 3–5% initial paid conversion hypothesis.

Review metrics before expanding the product.

13. DEFINITION OF SUCCESS

ORVELIA V1 is ready when:

1. A user can register and securely access an account.
2. A user can register and manage products.
3. A user can upload private documents.
4. The scanner can extract information and request confirmation.
5. A user can manage warranties and return deadlines.
6. Reminders are delivered reliably.
7. The dashboard shows accurate information.
8. Subscription limits are enforced on the backend.
9. Security policies have been tested.
10. The platform works on desktop and mobile browsers.

The mobile applications will be a subsequent development stage.

14. DEVELOPMENT PRINCIPLE

Build ORVELIA as a real technology company would build it.

Prioritize:

* Good architecture.
* Strong product fundamentals.
* Exceptional user experience.
* Security.
* Maintainability.
* Scalability.
* Measurable business value.

Do not sacrifice reliability for speed.

Do not implement all future modules at once.

Build a stable foundation and expand through controlled phases.