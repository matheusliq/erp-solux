# O Passo a Passo Detalhado do Sistema

## 1. Edição e Teste Local (Onde trabalhamos primeiro)
Toda nova feature, correção de bug ou mudança de cor você pede para mim (Antigravity). Eu ajusto o código, e você abre o terminal local e roda:

```bash
npm run dev
```
Aí você entra no `localhost:3000` para garantir que ficou exatamente como você queria.

## 2. Versionamento no Git (Salvar o progresso na nuvem)
Depois que tudo estiver perfeito na sua máquina, é hora de salvar esse "checkpoint" lá no GitHub. No terminal do Cursor/VSCode, você rodará 3 comandinhos básicos, em sequência:

Pega todas as alterações que fizemos:
```bash
git add .
```

Salva o "checkpoint" com uma mensagem dizendo o que foi feito:
```bash
git commit -m "feat: adicionado botão de relatório na tela Iago"
```

Envia para a nuvem (GitHub):
```bash
git push
```

## 3. O Novo Deploy

### O jeito mais fácil (Deploy Automático): 
Se você gerou o projeto no Vercel vinculando diretamente à sua conta do GitHub, você não precisa fazer mais nada! O Vercel percebe que o GitHub recebeu uma atualização ("git push") e sozinho recompila o aplicativo e joga a nova versão para o domínio.

### O jeito manual: 
Se você preferir fazer tudo na mão ou não vinculou ao GitHub, você só precisa ir no terminal do nosso projeto e rodar exatamente o que rodamos agora há pouco:
```bash
npx vercel --prod --yes
```

---
*Qualquer dúvida no processo, ou quando quiser fazer a primeira atualização do sistema, é só me chamar!*
