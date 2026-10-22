# MyBoot Simulator 2026 — Implementation Plan

A static web app that simulates the **Boost** employee share program: what you put in, what the company matches, the tax on the company match, dividends, and your profit or loss when you sell. It's styled like Apple (glassy, minimal, light and dark themes) and deployed to **GitHub Pages**.

---

## 1. Program rules (from the Boost subscription notice)

| Tier | Personal contribution (THB) | Company match (THB) | Total invested (THB) | Match ratio |
|---|---|---|---|---|
| 1 | 3,500 | 3,500 | 7,000 | 100% |
| 2 | 7,000 | 7,000 | 14,000 | 100% |
| 3 | 14,000 | 14,000 | 28,000 | 100% |
| 4 | 21,000 | 21,000 | 42,000 | 100% |
| 5 | 28,000 | 28,000 | 56,000 | 100% |
| 6 | 70,000 | 35,000 | 105,000 | 50% |
| 7 | 140,000 | 70,000 | 210,000 | 50% |
| 8 | 280,000 | 98,000 | 378,000 | 35% |

- **Purchase:** the total amount is converted into company shares at the last purchase price set on **10 Nov 2026**. This is the default purchase date.
- **Vesting / lock-up:** shares can't be sold until **3 years** after purchase.
- **Eligibility rule (user-defined):** a tier is only available if its personal contribution is **≤ 25% of yearly salary**.
- The PSP 25–28 matching cap is **out of scope**.

---

## 2. Decisions captured

| Topic | Decision |
|---|---|
| Language | English |
| Currency | Stock prices are entered in **EUR**, with an **EUR/THB exchange rate** for each date (purchase, tax, dividend, sale). All results are shown in **THB**, and EUR is shown as secondary. |
| Salary role | Limits which tiers you can pick: personal contribution ≤ **25%** of yearly salary. The cap is a constant in `config.ts`. |
| Tax on company match | `tax = matchingShares × taxDatePriceEUR × taxDateFX × taxRate%`. The tax rate is a 2-digit % (0–99). |
| Tax date | You enter the date and price freely. The default is the vesting date (purchase + 3 years). You can hold the shares without selling and still be taxed. |
| Tax payment | Chosen in the app: **Cash** (paid from salary, shares kept) or **Sell-to-cover** (just enough shares sold at the tax-date price to pay the tax). |
| Capital-gains tax | Not applied |
| Selling before vesting | **Blocked.** A sale date before the vesting date shows an inline warning, and results are disabled until it's fixed. |
| Fractional shares | Allowed |
| Dividends | Chosen in the app: **Cash** (added to profit) or **Reinvest** (buys more shares) |
| Extras | Compare all 8 tiers, dividend input, sale-price sensitivity chart with break-even point, holding period and annualized return, saving inputs in localStorage, exporting a PDF through print, light/dark theme |
| Tech | **Vite + vanilla TypeScript + Chart.js**, unit tests with Vitest, deployed to GitHub Pages by **GitHub Actions** |

---

## 3. Inputs (UI form)

**A. Profile**
1. Yearly salary (THB). This is required, and tiers above the 25% cap appear disabled with the reason shown.
2. Contribution tier, picked from 8 segmented cards. Each card shows personal, match and total.

**B. Purchase**
3. Purchase date (default `2026-11-10`)
4. Purchase price (EUR per share)
5. EUR/THB exchange rate at purchase

**C. Tax event (company match)**
6. Tax date (default = purchase date + 3 years)
7. Share price at the tax date (EUR)
8. EUR/THB exchange rate at the tax date
9. Tax rate %: a 2-digit integer from 0 to 99, using a slider and a number field
10. How the tax is paid: `Cash` or `Sell-to-cover`

**D. Dividends (optional, can be collapsed)**
11. Dividend per share per year (EUR)
12. Average EUR/THB exchange rate for dividends
13. What to do with dividends: `Cash` or `Reinvest`

**E. Sale**
14. Sale date (must be ≥ vesting date, otherwise it's blocked with a warning)
15. Sale price (EUR per share)
16. EUR/THB exchange rate at sale

Inputs are checked as you type. Every input is saved to `localStorage` (key `boost-sim:v1`), and there's a **Reset** button.

---

## 4. Calculation model (`src/calc/`)

All functions are pure and unit-tested. The notation is:
`P0, FX0` = purchase price and rate, `Pt, FXt` = tax-date price and rate, `Ps, FXs` = sale price and rate.

```
personal, match            = TIERS[tier]
total                      = personal + match
priceTHB0                  = P0 × FX0
sharesPersonal             = personal / priceTHB0
sharesMatch                = match / priceTHB0
sharesTotal                = sharesPersonal + sharesMatch

taxableValueTHB            = sharesMatch × Pt × FXt
tax                        = taxableValueTHB × taxRate / 100

if taxMode == Cash:
    taxCash                = tax
    sharesAfterTax         = sharesTotal
if taxMode == SellToCover:
    taxCash                = 0
    sharesSoldForTax       = tax / (Pt × FXt)
    sharesAfterTax         = sharesTotal − sharesSoldForTax

dividends (per full/partial year between purchase and sale, pro-rated):
    Cash:     divCash      = Σ sharesHeld × dps × FXdiv × yearFraction
    Reinvest: extra shares = sharesHeld × dps / Pref, where Pref is linearly
              interpolated through the purchase, tax-date and sale prices on
              each dividend date. (This assumption is stated in the UI.)
    Dividends are paid on each purchase anniversary, plus a pro-rated part
    on the sale date. Shares sold to cover tax stop earning after the tax date.

finalShares                = sharesAfterTax (+ reinvested shares)
saleProceeds               = finalShares × Ps × FXs

ownCashOut                 = personal + taxCash
netProfit                  = saleProceeds + divCash − ownCashOut
returnOnOwnMoney %         = netProfit / ownCashOut
holdingYears               = (saleDate − purchaseDate) / 365.25
annualized (XIRR)          = solved over dated cash flows:
                             −personal @ purchase, −taxCash @ taxDate,
                             +divCash @ each dividend date, +saleProceeds @ saleDate

breakEvenSalePriceEUR      = (ownCashOut − divCash) / (finalShares × FXs)
```

**What drives the result.** The profit is split into the following parts, which add up to `netProfit`. The waterfall chart uses these.
1. Company match (free money) = `match`
2. Market gain or loss = value of `sharesTotal` at sale price × FXs − `total`, with exchange-rate effects split out separately
3. Exchange-rate gain or loss = `sharesTotal × Ps × (FXs − FX0)`
4. Dividends = `divCash`, or the value of the reinvested shares
5. Tax = `−tax` (paid in cash, or as the value of shares sold to cover it)

**Comparison benchmark:** the same personal money invested with **no match** and **no tax on the match**. This shows the extra value the Boost program adds.

---

## 5. Outputs and visualizations

1. **Headline cards** (glass tiles): Net profit/loss (THB, green or red), return on own money %, annualized return (XIRR), final shares, break-even sale price (EUR).
2. **Profit waterfall** (Chart.js bar chart with floating bars): Your contribution → + Company match → ± Market → ± Exchange rate → + Dividends → − Tax → **Final value**.
3. **Sale-price sensitivity:** a line chart of net profit (THB) against sale price, from 50% to 200% of the purchase price. It shows a zero line, a marked **break-even point** and the currently selected sale price, with the profit area shaded green and the loss area shaded red.
4. **Tier comparison:** a grouped bar chart and table for all 8 tiers, using the current prices and rates. It compares own cash out, net profit, return % and annualized return. Tiers you can't pick because of the salary cap appear greyed out. It also points out the "best return on own money" tier (tiers 1–5 at 100% match).
5. **Timeline:** a horizontal strip showing Purchase, Tax date, Vesting and Sale, with any warning (for example, a sale before vesting).
6. **Detailed P&L table:** each line item in THB, with EUR where relevant.
7. **Disclaimer:** this is a simulation only, not financial or tax advice, and the user should check the official plan rules.

---

## 6. UI / UX: Apple glassy minimal

- **Layout:** one page. A sticky glass top bar has the title "MyBoot Simulator 2026", the theme toggle, and the Print/PDF and Reset buttons. On desktop, the input panel is on the left and results on the right. On mobile, everything stacks into one column.
- **Glass:** `backdrop-filter: blur(24px) saturate(180%)`, translucent white or black fills (`rgba(255,255,255,.55)` / `rgba(28,28,30,.55)`), a 1px light inner border, a soft large shadow and 20–24px corner radius.
- **Background:** slowly drifting blurred colour shapes (blue, purple, teal) behind the glass. These are turned off when the user has `prefers-reduced-motion` set.
- **Typography:** `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui`. Numbers use tabular figures.
- **Colours:** iOS system colours, with green `#34C759` for profit, red `#FF3B30` for loss and blue `#0A84FF` as the accent.
- **Theme:** follows the system setting by default, with a toggle (Light / Dark / Auto) that is saved in localStorage. Chart colours update when the theme changes.
- **Controls:** segmented control (tax mode, dividend mode), rounded inputs with EUR/THB/% suffixes, sliders, and number animations (count-up).
- **Accessibility:** labelled inputs, visible keyboard focus, AA contrast in both themes, and charts that also have a data-table version.
- **Print / PDF:** a `@media print` stylesheet removes the glass and blur, shows a white background, hides the controls, prints a summary of inputs and the results, and keeps charts on whole pages. This uses `window.print()`.

---

## 7. Project structure

```
Boost/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts              # base: '/<repo-name>/' for GitHub Pages
├─ public/
│  └─ favicon.svg
├─ src/
│  ├─ main.ts                  # starts the app, connects state → render
│  ├─ config.ts                # TIERS, SALARY_CAP_PCT=25, VESTING_YEARS=3, defaults
│  ├─ state.ts                 # app state, localStorage save/load, change notifications
│  ├─ calc/
│  │  ├─ simulate.ts           # main simulate(inputs) → result
│  │  ├─ dividends.ts          # anniversary dividend schedule, price interpolation
│  │  ├─ xirr.ts               # Newton-Raphson with bisection fallback
│  │  ├─ sensitivity.ts        # profit vs sale price, break-even, tier comparison
│  │  ├─ validate.ts           # input rules, salary cap, vesting block
│  │  ├─ dates.ts              # UTC date helpers
│  │  └─ types.ts
│  ├─ ui/
│  │  ├─ form.ts               # inputs, checks, tier cards
│  │  ├─ summary.ts            # headline cards, P&L table, tier table, print summary
│  │  ├─ timeline.ts
│  │  └─ theme.ts              # light/dark/auto
│  ├─ charts/
│  │  ├─ setup.ts              # Chart.js registration, theme palette
│  │  ├─ waterfall.ts
│  │  ├─ sensitivity.ts
│  │  └─ tiers.ts
│  ├─ format.ts                # THB/EUR/% formatting (Intl.NumberFormat)
│  └─ styles/
│     ├─ tokens.css            # colours, radii, shadows (light/dark)
│     ├─ glass.css
│     ├─ layout.css
│     └─ print.css
├─ tests/
│  ├─ simulate.test.ts
│  ├─ xirr.test.ts
│  └─ sensitivity.test.ts
├─ .github/workflows/deploy.yml
├─ README.md
└─ PLAN.md
```

**Dependencies:** `vite`, `typescript`, `vitest` (dev); `chart.js` (runtime). No UI framework, which keeps the bundle small and loading fast.

---

## 8. Deployment (GitHub Pages via Actions)

1. Set `vite.config.ts` → `base: process.env.BASE_PATH ?? './'`. Relative asset paths work under any `/<repo-name>/` sub-path, even after a repo rename.
2. `.github/workflows/deploy.yml`:
   - Runs on `push` to `main` or manually (`workflow_dispatch`).
   - Job `build`: `actions/checkout` → `actions/setup-node` (Node 22, npm cache) → `npm ci` → `npm test` → `npm run build` → `actions/upload-pages-artifact` (`dist/`).
   - Job `deploy`: `actions/deploy-pages`, with permissions `pages: write` and `id-token: write`.
3. In the repo, go to **Settings → Pages → Source: GitHub Actions**.
4. The README explains local development (`npm run dev`) and deployment.

---

## 9. Implementation steps

1. **Scaffold:** set up Vite with vanilla TypeScript, add Chart.js and Vitest, and create the folder structure.
2. **Config and calculations:** `config.ts`, `simulate.ts`, `dividends.ts`, `xirr.ts`, `sensitivity.ts`.
3. **Unit tests:** cover all 8 tiers, both tax modes, both dividend modes, the salary cap, blocking sales before vesting, XIRR against known values, and a check that the break-even price really gives a profit of 0.
4. **Styles:** tokens, glass components, layout, light/dark theme, print stylesheet.
5. **Form and state:** inputs, checks, tier cards with disabled states, saving to localStorage.
6. **Results:** headline cards, P&L table, timeline.
7. **Charts:** waterfall, sensitivity with break-even, tier comparison, all following the theme.
8. **Polish:** number animations, mobile layout, accessibility checks, disclaimer.
9. **Deploy:** GitHub Actions workflow and README. Check that the built `dist/` works under a sub-path.
10. **Verify:** run `npm test`, run `npm run build`, open the preview in a browser, and check light/dark themes, mobile width and the print preview.

---

## 10. Worked example (for testing)

Inputs: salary 1,200,000 THB (cap 300,000, so all tiers are allowed), **Tier 6** (70,000 + 35,000), P0 = €300, FX0 = 38.0, tax at vesting with Pt = €350, FXt = 38.0, tax rate 20%, Cash tax, no dividends, sale at vesting with Ps = €350, FXs = 38.0.

- priceTHB0 = 11,400 → sharesTotal = 105,000 / 11,400 = **9.2105**, sharesMatch = **3.0702**
- tax = 3.0702 × 350 × 38 × 20% = **8,166.67 THB**
- saleProceeds = 9.2105 × 350 × 38 = **122,500 THB**
- ownCashOut = 70,000 + 8,166.67 = **78,166.67**
- **netProfit = 44,333.33 THB** (+56.7% on own money)
- breakEven Ps = 78,166.67 / (9.2105 × 38) = **€223.33**

---

## 11. Assumptions and open points

- Tier amounts and the 25% salary cap are constants in `config.ts`, so they're easy to update for future program years.
- The tax is assumed to apply only to the company-matched shares, valued on the tax date. The tax on the personal contribution is assumed to be already settled through payroll.
- Dividend reinvestment uses an interpolated price. This is an approximation and is labelled as one in the UI.
- No brokerage or transfer fees and no capital-gains tax, as you decided.
- No stock prices or exchange rates are fetched live. Everything is entered by the user, so the app has no API dependencies or CORS issues.
