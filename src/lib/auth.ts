import jwt from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';

interface TokenPayload {
  userId: string;
  role: 'USER' | 'ADMIN' | 'WORKER';
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    (request as any).user = payload;
  } catch (err) {
    return reply.code(401).send({ message: 'Invalid or expired token' });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as { role: string } | undefined;

    if (!user || !allowedRoles.includes(user.role)) {
      return reply.code(403).send({ message: 'You do not have permission to perform this action' });
    }
  };
}