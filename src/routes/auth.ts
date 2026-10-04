import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { loginSchema, registerSchema } from '../schema/auth.schema.js';
import jwt from 'jsonwebtoken';


export async function authRoutes(app: FastifyInstance) {
    app.post('/auth/register', { schema: registerSchema }, async (request, reply) => {
        const { email, password } = request.body as { email: string; password: string };

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return reply.code(409).send({ message: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { email, password: passwordHash },
        });

        return reply.code(201).send({ id: user.id, email: user.email, role: user.role });
    });

    app.post('/auth/login', { schema: loginSchema }, async (request, reply) => {
        const { email, password } = request.body as { email: string; password: string };

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return reply.code(401).send({ message: 'Invalid email or password' });
        }

        const passwordMatches = await bcrypt.compare(password, user.password);

        if (!passwordMatches) {
            return reply.code(401).send({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' }
        );

        return reply.send({ token });
    });
}