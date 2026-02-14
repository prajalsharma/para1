# Para Allowance Wallet

A parent-child crypto allowance wallet built with Para SDK, React, and TypeScript.

## Features

- **Parent Dashboard**: Create policies with customizable permissions
- **Child View**: View allowance rules and wallet balance
- **Dynamic Permissions**: Configure chain restrictions and spending limits
- **Server-Side Wallet Creation**: Secure wallet creation via Para API

## Environment Variables

### Required for Vercel/Production

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_PARA_API_KEY` | Para client API key (publishable) | `pk_...` |
| `PARA_SECRET_KEY` | Para server API key (secret) | `sk_...` |
| `VITE_PARA_ENV` | Environment: `development` or `production` | `development` |

### Optional: Payment Integration (Stripe)

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key (server-side) | `sk_test_...` |
| `VITE_STRIPE_KEY` | Stripe publishable key (client-side) | `pk_test_...` |

If Stripe keys are not configured, wallet creation uses dev stub mode (still calls real Para API).

## Local Development

```bash
# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Edit .env with your Para API key
# Get keys from https://developer.getpara.com

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment to Vercel

1. Push to GitHub
2. Import to Vercel
3. Set environment variables in Vercel Dashboard:
   - `VITE_PARA_API_KEY` (required)
   - `PARA_SECRET_KEY` (required for wallet creation)
   - `VITE_PARA_ENV` (optional, defaults to `development`)
4. Deploy

## API Endpoints

### `POST /api/child/create-wallet`

Creates a child wallet via Para API (server-side).

**Request:**
```json
{
  "parentWalletAddress": "0x...",
  "restrictToBase": true,
  "maxUsd": 15,
  "policyName": "Weekly Allowance",
  "devMode": true
}
```

**Response:**
```json
{
  "success": true,
  "walletAddress": "0x...",
  "walletId": "wallet_...",
  "policy": {
    "name": "Weekly Allowance",
    "allowedChains": ["8453"],
    "hasUsdLimit": true,
    "usdLimit": 15,
    "restrictToBase": true
  }
}
```

### `GET /api/_checks/wallet-flow`

Health check endpoint for CI/CD.

## Para Permissions Model

The app follows Para's Permissions framework:

```
Policy → Scope → Permission → Condition
```

- **Policy**: App-specific permissions contract
- **Scope**: User-facing consent grouping
- **Permission**: Specific executable action (transfer, sign)
- **Condition**: Constraints (chain, value limit)

See: https://docs.getpara.com/v2/concepts/permissions

## Troubleshooting

### Debug Script

Run the debug script to check your setup:

```bash
npm run debug
```

### Common Issues

**1. Blank page or app won't load**
- Check browser console (F12 → Console) for errors
- Verify Node.js version: `node --version` (requires v20+)
- Run `npm install` to ensure dependencies are installed

**2. Login modal doesn't open**
- Check that `VITE_PARA_API_KEY` is set correctly in `.env`
- No spaces around `=` and no quotes: `VITE_PARA_API_KEY=pk_abc123`
- Check browser console for Para SDK errors

**3. OTP not received (Beta environment)**
- Beta only works with test emails: `yourname@test.getpara.com`
- Any OTP code works in Beta: `123456`
- Real emails won't receive OTP in Beta environment

**4. Environment variable not working**
- File must be named `.env` (not `.env.local`)
- No spaces: `VITE_PARA_API_KEY=value` not `VITE_PARA_API_KEY = value`
- No quotes: `VITE_PARA_API_KEY=pk_abc` not `VITE_PARA_API_KEY="pk_abc"`
- Restart dev server after changing `.env`

**5. npm install fails**
- Requires Node.js 20+: `nvm install 20 && nvm use 20`
- Clear cache: `rm -rf node_modules package-lock.json && npm install`

## Server/Client Import Rules

### CRITICAL: Node-Only Modules

The Para SDK includes optional connectors for Cosmos, Solana, and Celo which depend on Node-only modules. These **cannot** be imported in client-side code.

**Forbidden in client code:**
- `@celo/utils` - Celo blockchain utilities (Node only)
- `@cosmjs/encoding` - Cosmos SDK encoding (Node only)
- Any `crypto` modules without browser polyfills

**How it's handled:**
1. `vite.config.ts` has a `stubMissingDeps` plugin that intercepts these imports
2. `src/stubs/` contains silent no-op stubs for forbidden modules
3. `npm run check-bundle` verifies no forbidden modules leaked into the bundle

**Adding new stubs:**
1. Create a stub file in `src/stubs/` that exports silent no-ops (NOT throwing errors)
2. Add the alias to `vite.config.ts` → `resolve.alias`
3. Run `npm run build:verify` to confirm

### CI Bundle Checks

```bash
# Build and verify no forbidden modules in bundle
npm run build:verify

# Or separately:
npm run build
npm run check-bundle
```

The check script will fail CI if any of these patterns appear in the built bundle:
- `@celo/utils/lib/ecies is not available in browser`
- `@celo/utils is not available in browser`
- `@cosmjs/encoding is not available`

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Para React SDK 2.10
- TailwindCSS
- Vercel Serverless Functions
