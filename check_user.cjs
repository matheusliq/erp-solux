const { Client } = require('/Users/matheus/erp-solux/node_modules/pg');
const bcrypt = require('/Users/matheus/erp-solux/node_modules/bcryptjs');

const client = new Client({
    connectionString: 'postgresql://postgres.imlzvrzlyegqpsuansrb:SoluxPinturas123@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    await client.connect();
    console.log('Conectado ao banco!');

    // Listar todos os usuários
    const all = await client.query('SELECT username, name, role FROM users ORDER BY name');
    console.log('\n=== Todos os usuários ===');
    all.rows.forEach(u => console.log(`  ${u.username} | ${u.name} | ${u.role}`));

    // Verificar sarah.liquer
    const res = await client.query("SELECT id, username, name, role, password FROM users WHERE username = 'sarah.liquer'");
    if (res.rows.length === 0) {
        console.log('\n❌ sarah.liquer NÃO existe no banco!');
    } else {
        const user = res.rows[0];
        console.log('\n✅ sarah.liquer encontrado:', user.name, '|', user.role);
        const ok = await bcrypt.compare('SoluxPinturas123', user.password);
        console.log('Senha SoluxPinturas123 bate?', ok);
        if (!ok) {
            const h = await bcrypt.hash('SoluxPinturas123', 10);
            await client.query('UPDATE users SET password = $1 WHERE username = $2', [h, 'sarah.liquer']);
            console.log('🔧 Senha corrigida com sucesso!');
        } else {
            console.log('✅ A senha já está correta!');
        }
    }

    await client.end();
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
