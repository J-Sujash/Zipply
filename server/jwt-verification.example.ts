/**
 * Server-Side JWT Verification for Supabase
 * 
 * This example shows how to verify Supabase JWT tokens on your application server.
 * Use this pattern for any backend API endpoints that need to authenticate users.
 * 
 * SECURITY CHECKLIST:
 * ✅ Verify JWT signature
 * ✅ Verify expiration
 * ✅ Verify claims (user id)
 * ✅ Verify issuer (your Supabase project)
 * 
 * Installation (Node.js/Express example):
 * npm install jsonwebtoken jwks-rsa
 */

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// Your Supabase project URL
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nnbekvfmsuprjvzscbpk.supabase.co';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET; // Get from Supabase dashboard > Settings > API

// JWKS client for fetching public keys
const client = jwksClient({
  jwksUri: `${SUPABASE_URL}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

// Get signing key
function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify Supabase JWT token
 * @param token - The JWT access token from the Authorization header
 * @returns Decoded token payload or null if invalid
 */
export async function verifySupabaseToken(token: string): Promise<any | null> {
  try {
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/, '');

    // Verify token
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        cleanToken,
        getKey,
        {
          algorithms: ['RS256'],
          issuer: `${SUPABASE_URL}/auth/v1`,
          // You can add more verification options here
        },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded);
          }
        }
      );
    });

    // Additional verification: Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      console.error('❌ Token expired');
      return null;
    }

    // Additional verification: Check that it's a valid Supabase token
    if (!decoded.sub || !decoded.email) {
      console.error('❌ Invalid token claims');
      return null;
    }

    console.log('✅ Token verified successfully');
    return decoded;
  } catch (error) {
    console.error('❌ Token verification failed:', error);
    return null;
  }
}

/**
 * Express middleware example
 * Use this to protect routes that require authentication
 */
export function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  verifySupabaseToken(authHeader)
    .then((decoded) => {
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Attach user info to request
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
      };

      next();
    })
    .catch((error) => {
      console.error('Auth middleware error:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    });
}

/**
 * Example protected route
 */
// app.get('/api/protected', requireAuth, async (req, res) => {
//   // req.user is now available with user info
//   const userId = req.user.id;
//   res.json({ message: 'Protected route', userId });
// });

/**
 * Alternative: Simple verification using JWT_SECRET (if available)
 * This is simpler but less secure - JWKS is preferred
 */
export function verifyTokenSimple(token: string): any | null {
  try {
    const cleanToken = token.replace(/^Bearer\s+/, '');
    
    if (!SUPABASE_JWT_SECRET) {
      console.error('❌ SUPABASE_JWT_SECRET not configured');
      return null;
    }

    const decoded = jwt.verify(cleanToken, SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
    });

    return decoded;
  } catch (error) {
    console.error('❌ Token verification failed:', error);
    return null;
  }
}

/**
 * Fastify plugin example
 */
// import { FastifyRequest, FastifyReply } from 'fastify';
// 
// export async function fastifyAuth(
//   request: FastifyRequest,
//   reply: FastifyReply
// ) {
//   const authHeader = request.headers.authorization;
// 
//   if (!authHeader) {
//     return reply.status(401).send({ error: 'No authorization header' });
//   }
// 
//   const decoded = await verifySupabaseToken(authHeader);
// 
//   if (!decoded) {
//     return reply.status(401).send({ error: 'Invalid or expired token' });
//   }
// 
//   (request as any).user = {
//     id: decoded.sub,
//     email: decoded.email,
//   };
// }

