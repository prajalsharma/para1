/**
 * Debug endpoint to view all stored policies
 *
 * This endpoint is for development/testing only.
 * In production, this should be secured or removed.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAllPolicies } from '../lib/policyStorage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const policies = await getAllPolicies();

    return res.status(200).json({
      success: true,
      count: policies.length,
      policies: policies.map((p) => ({
        walletAddress: p.walletAddress,
        parentAddress: p.parentAddress,
        policyName: p.policy.name,
        allowedChains: p.policy.allowedChains,
        conditions: p.policy.globalConditions.map((c) => ({
          type: c.type,
          operator: c.operator,
          value: c.value,
        })),
        createdAt: new Date(p.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
