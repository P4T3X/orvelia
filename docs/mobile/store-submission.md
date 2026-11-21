# Store submission (App Store and Google Play)

## Accounts (owner: Lucioni Enterprises)
- Apple Developer Program (organization account needs a D-U-N-S number).
- Google Play Console (organization account; identity verification).
- Expo account with the `orvelia` project (`eas init`).

## Identity
| | iOS | Android |
| --- | --- | --- |
| Name | ORVELIA | ORVELIA |
| Bundle / package | `com.lucionienterprises.orvelia` | `com.lucionienterprises.orvelia` |
| Category | Productividad (secondary: Finanzas) | Productividad |
| Age rating | 4+ | Everyone |

Change the bundle id in `app.config.ts` before the first build if you prefer
another one; it can't be changed after the app is published.

## Listing copy (Spanish, Peru)
- **Subtítulo (iOS, 30):** Garantías y comprobantes en orden
- **Descripción corta (Play, 80):** Guarda tus productos, comprobantes y garantías, y recibe avisos antes de que venzan.
- **Descripción:** ORVELIA guarda lo que compras con su comprobante, su garantía y
  sus documentos. Escanea la boleta o factura y ORVELIA lee la tienda, la fecha,
  el total y los productos. Te avisamos antes de que venza una garantía o un plazo
  de devolución. Pregúntale a ORVELIA AI cuánto gastaste o qué garantías vencen
  pronto. Con Ultra, comparte productos con tu familia.
- **Screenshots:** 6.9" iPhone and a phone for Play (home, collection, product,
  scan review, upcoming, assistant). Take them from a development build.

## Privacy (App Store "App Privacy" and Play "Data safety")
Data collected, all **linked to the user**, none used for tracking or ads:
| Data | Purpose |
| --- | --- |
| Email address, name | Account |
| Photos (receipts, products) | App functionality |
| Purchase history the user enters (products, prices, receipts) | App functionality |
| Other user content (documents, notes) | App functionality |
| Device push token | App functionality (reminders) |

- Data is encrypted in transit; users can delete their account **in the app**
  (Ajustes → Eliminar mi cuenta) and download their data on the web.
- Privacy policy URL: `https://<domain>/privacy`. Account deletion URL (Play):
  `https://<domain>/app/settings#datos`.
- AI: receipt photos and questions are sent to the AI provider through the
  Vercel AI Gateway only to produce the answer; say so in the policy.

## Review notes
- Provide a demo account with sample products (reviewers can't create receipts
  of their own purchases).
- Subscriptions are sold on the web with Mercado Pago. The app neither sells
  them nor links or points to the purchase page; it only shows the current plan
  (a "reader"-style multiplatform service). Paid features unlock when the
  account has the plan. Confirm the current App Store rules (3.1.1 / 3.1.3) and
  Google Play payments policy before submitting.

## Release
1. `eas build --profile production --platform all`
2. Test the builds from TestFlight / Play internal testing on real phones:
   camera, push permission and delivery, deep link from a notification.
3. `eas submit --profile production --platform ios|android`
4. Over-the-air fixes for JavaScript-only changes: `eas update --channel production`.
