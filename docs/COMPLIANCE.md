# Business jurisdiction and compliance assumptions

These are the rules the codebase and documentation follow. Anything marked **to confirm** must be settled with the client and counsel before launch.

## Market and entity

| Item | Position |
| --- | --- |
| Primary customer market | United States |
| Platform currency | USD (enforced in the database for subscription payments) |
| Display timezone | US Eastern by default (`APP_TIMEZONE`, IANA name) |
| Legal entity and incorporation country | **To confirm.** Do not assume US or any other country |
| Merchant (payment) registration jurisdiction | **To confirm.** Determines which payment processors can be used and on what terms |
| Developer location | Not relevant to the business's jurisdiction and never used as a compliance default |

## Subscription payments (Phase 1)

- Card processing: Stripe is the default for a US-targeted product. Paystack is supported in code but should only be enabled if the merchant entity is in a country Paystack serves and the account is approved for USD.
- Each processor is enabled only when its keys are set, and must be approved for the confirmed merchant entity first.
- **Crypto (BTC, ETH, USDT)** is built but **off by default** (`CRYPTO_PAYMENTS_ENABLED=false`). Turn it on only after (a) legal sign-off for the merchant's jurisdiction and the customer states served (for example state money-transmission and consumer-protection rules) and (b) NOWPayments approval for the account.
- Subscription money is kept separate from any future wagering money (`public.payments` vs the `sportsbook` schema).

## Sportsbook (future phase)

- Real-money betting, deposits and withdrawals are disabled in code and blocked by the database.
- Any future sportsbook must run through a licensed operator, **only in the specific US states where that operator is authorized**. Those states go in `sportsbook.licensed_jurisdictions` with a licence reference; every other state is refused.
- A certified geolocation check (not IP alone) and the state's minimum age (usually 21) will be required before any wager. Interfaces: `GeolocationProvider`, `JurisdictionPolicy` in `src/lib/sportsbook/types.ts`.

## Consumer-facing content

- Age gate for the analysis subscription: 18+ (**to confirm**; some clients choose 21+ to match US betting age).
- Responsible-gambling messaging uses the US National Problem Gambling Helpline (1-800-GAMBLER).
- Privacy policy must be reviewed against applicable US state privacy laws (for example CCPA/CPRA) and any other regions served, once the entity is confirmed.
- Terms: governing law and venue follow the confirmed entity.
