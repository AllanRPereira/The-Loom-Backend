# Guia Rápido: Migrações Prisma no Render

## 🎯 Primeiro Deploy (Banco Vazio)

### Opção 1: Usar `prisma db push` (Mais Simples - Recomendado)

1. Faça o deploy normalmente no Render
2. Após o deploy, abra o Shell do Web Service
3. Execute:
```bash
npx prisma db push
```

**Vantagens:**
- Mais rápido
- Não precisa commitar arquivos de migração
- Ideal para protótipos e primeiro deploy

**Desvantagens:**
- Não cria histórico de migrações
- Menos controle sobre mudanças de schema

---

### Opção 2: Criar Migrações Completas (Produção)

#### Passo 1: Criar Migrações Localmente

```bash
# Se você tem migrações antigas do SQLite, apague-as
rm -rf prisma/migrations

# Crie a migração inicial
npx prisma migrate dev --name init
```

Isso criará a pasta `prisma/migrations/` com os arquivos SQL.

#### Passo 2: Commitar e Push

```bash
git add prisma/migrations
git commit -m "Adicionar migrações iniciais para PostgreSQL"
git push origin main
```

#### Passo 3: Aplicar no Render

Após o deploy, abra o Shell e execute:
```bash
npx prisma migrate deploy
```

**Vantagens:**
- Histórico completo de mudanças
- Melhor para produção
- Rollback possível

---

## 🔄 Migrações Futuras (Após Primeiro Deploy)

### Quando Você Alterar o Schema

1. **Edite** `prisma/schema.prisma`:
```prisma
model Job {
  id              Int      @id
  txHash          String
  status          String
  requester       String
  provider        String?
  dataUrl         String
  scriptUrl       String
  resultUrl       String?
  rewardUsd       String
  rewardEth       String
  createdAt       DateTime @default(now())  // 👈 Nova coluna
}
```

2. **Crie a migração** localmente:
```bash
npx prisma migrate dev --name add_created_at
```

3. **Teste** localmente:
```bash
npm run dev
```

4. **Commite e Push**:
```bash
git add prisma/
git commit -m "Adicionar coluna createdAt"
git push origin main
```

5. **Render aplica automaticamente** (se configurado) ou execute manualmente no Shell:
```bash
npx prisma migrate deploy
```

---

## 🤖 Aplicar Migrações Automaticamente

### Atualizar render.yaml

Modifique o `buildCommand` do Web Service:

```yaml
services:
  - type: web
    name: loom-backend-api
    buildCommand: npm install && npx prisma generate && npx prisma migrate deploy && npm run build
    # ... resto da configuração
```

Agora, toda vez que você fizer push, o Render:
1. Instala dependências
2. Gera o cliente Prisma
3. **Aplica migrações pendentes** ✨
4. Faz build do Next.js

---

## 📋 Comandos Úteis

### No Shell do Render:

```bash
# Ver status das migrações
npx prisma migrate status

# Aplicar migrações pendentes
npx prisma migrate deploy

# Ver schema atual do banco
npx prisma db pull

# Abrir Prisma Studio (visualizar dados)
npx prisma studio
```

### Localmente:

```bash
# Criar migração em desenvolvimento
npx prisma migrate dev --name nome_da_migracao

# Resetar banco (CUIDADO: apaga dados)
npx prisma migrate reset

# Aplicar migrações (produção)
npx prisma migrate deploy

# Ver status
npx prisma migrate status
```

---

## ⚠️ Problemas Comuns

### Erro: "Database schema is not in sync"

**Causa:** Schema do banco diferente do `schema.prisma`

**Solução 1 (Desenvolvimento/Teste):**
```bash
npx prisma db push --force-reset
```

**Solução 2 (Produção - Preserva dados):**
```bash
npx prisma migrate deploy
```

### Erro: "Migration failed to apply"

**Causa:** Conflito com dados existentes

**Soluções:**
1. **Adicionar migração customizada**:
```bash
npx prisma migrate dev --create-only --name fix_issue
# Edite o arquivo SQL gerado em prisma/migrations
npx prisma migrate dev
```

2. **Backup e reset** (última opção):
```bash
# No Render Shell
npx prisma migrate reset --force
```

### Erro: "P3009: migrate found failed migrations"

**Causa:** Migrações falharam anteriormente

**Solução:**
```bash
npx prisma migrate resolve --applied "nome_da_migracao"
```

---

## 🎓 Melhores Práticas

### ✅ DO (Faça)

1. **Sempre teste migrações localmente primeiro**
2. **Commite arquivos de migração no Git**
3. **Use nomes descritivos**: `add_user_role`, `fix_index_on_jobs`
4. **Faça backup antes de mudanças grandes**
5. **Documente migrações complexas**

### ❌ DON'T (Não Faça)

1. ~~Editar migrações já aplicadas~~
2. ~~Deletar pasta `prisma/migrations` em produção~~
3. ~~Usar `db push` em produção com dados importantes~~
4. ~~Fazer migrações diretamente no banco sem Prisma~~
5. ~~Ignorar avisos do Prisma sobre perda de dados~~

---

## 🔍 Verificar se Está Tudo Certo

```bash
# 1. Verificar conexão
npx prisma db execute --stdin <<< "SELECT 1;"

# 2. Ver tabelas criadas
npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"

# 3. Ver status das migrações
npx prisma migrate status

# Deve retornar: "Database schema is up to date!"
```

---

## 📚 Referências

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Render Deploy Docs](https://render.com/docs/deploy-prisma)
- [Guia de Deploy Principal](./DEPLOY.md)
