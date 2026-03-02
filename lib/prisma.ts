import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const prismaClientSingleton = () => {
    // 1. Criamos um "Pool" de conexões usando o seu link do Supabase
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // 2. Passamos esse Pool para o Adaptador Oficial do Prisma
    const adapter = new PrismaPg(pool);

    // 3. O Prisma 7 agora aceita o construtor perfeitamente
    return new PrismaClient({ adapter });
};

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;