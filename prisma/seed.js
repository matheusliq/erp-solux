const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const users = [
        { name: 'Matheus', username: 'matheus.liquer', password: 'SoluxPinturas123' },
        { name: 'Sarah', username: 'sarah.liquer', password: 'SoluxPinturas123' },
        { name: 'Maykon', username: 'maykon.nunes', password: 'SoluxPinturas123' },
        { name: 'Andressa', username: 'andressa.cristina', password: 'SoluxPinturas123' }
    ];

    for (const u of users) {
        const hashedPassword = await bcrypt.hash(u.password, 10);

        await prisma.users.upsert({
            where: { username: u.username },
            update: { password: hashedPassword, name: u.name },
            create: {
                username: u.username,
                name: u.name,
                password: hashedPassword,
                role: 'partner'
            }
        });
        console.log(`User ${u.username} seeded.`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
