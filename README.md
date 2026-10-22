# Boost Simulator

An investment simulator for the EssilorLuxottica **Boost** employee share plan. Enter your salary, contribution tier, share prices and EUR/THB rates, then see how the company match, tax, dividends and your sale price add up to a profit or loss.

Built with Vite, TypeScript and Chart.js. It's a static site with no backend: all calculations run in the browser, and inputs are saved only in your browser's localStorage.

## Features

- Eight contribution tiers with company matching. A tier is available only if your contribution is at most 25% of your yearly salary.
- Tax on matched shares, charged on a tax date you choose (the default is the vesting date). You can pay it **in cash** or by **selling shares to cover it**.
- Dividends, taken **as cash** or **reinvested**.
- A 3-year lock-up: sale dates before vesting are blocked.
- Summary cards: net profit, return on your money, annualized return (XIRR), break-even sale price, and the extra you get from Boost.
- Charts: a waterfall showing where your result comes from, profit at different sale prices with the break-even point, and a comparison of all tiers.
- A detailed profit and loss table, a timeline, light/dark/auto theme, and Export to PDF (through print).

The calculation model is described in [PLAN.md](./PLAN.md).

## Development

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests (Vitest)
npm run build     # type-check + production build to dist/
npm run preview   # serve the built site
```

Program constants (tiers, salary cap, vesting years, default purchase date) are in `src/config.ts`.

## Deploy to GitHub Pages

1. Push this project to a GitHub repository on the `main` branch.
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Each push to `main` runs `.github/workflows/deploy.yml`, which tests, builds (with `BASE_PATH=/<repo-name>/`) and publishes the site to `https://<user>.github.io/<repo-name>/`.

## Disclaimer

For illustration only. This is not financial or tax advice. Check the official Boost plan rules and your local tax rules.
