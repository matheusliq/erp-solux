import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.users.findUnique({ where: { username: 'sarah.liquer' } });
    if (!user) {
        console.log('NAO EXISTE. Todos os usuarios:');
        const all = await prisma.users.findMany({ select: { username: true, name: true, role: true } });
        all.forEach(u => console.log(JSON.stringify(u)));
    } else {
        console.log('Existe:', user.username, user.name, user.role);
        const ok = await bcrypt.compare('SoluxPinturas123', user.password);
        console.log('Senha bate?', ok);
        if (!ok) {
            const h = await bcrypt.hash('SoluxPinturas123', 10);
            await prisma.users.update({ where: { username: 'sarah.liquer' }, data: { password: h } });
            console.log('Senha corrigida!');
        }
    }
    await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
