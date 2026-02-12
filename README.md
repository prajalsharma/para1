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

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Para React SDK 2.10
- TailwindCSS
- Vercel Serverless Functions
