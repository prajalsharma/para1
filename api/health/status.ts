/**
 * Health Check Endpoint for Wallet Flow
 *
 * This endpoint verifies that the wallet creation flow is properly configured.
 * Used by CI/CD pipelines to verify deployment.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks = {
    paraApiKeyConfigured: !!process.env.PARA_SECRET_KEY,
    paraEnv: process.env.VITE_PARA_ENV || 'development',
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    timestamp: new Date().toISOString(),
  };

  const allCriticalPassed = checks.paraApiKeyConfigured;

  return res.status(allCriticalPassed ? 200 : 503).json({
    status: allCriticalPassed ? 'healthy' : 'unhealthy',
    checks,
    message: allCriticalPassed
      ? 'Wallet creation flow is ready'
      : 'Missing PARA_SECRET_KEY - wallet creation will fail',
  });
}
