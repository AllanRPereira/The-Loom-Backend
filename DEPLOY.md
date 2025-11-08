# Guia de Deploy no Render - The Loom Backend

Este guia descreve como fazer o deploy do backend The Loom na plataforma Render.

## 📋 Pré-requisitos

- Conta no [Render](https://render.com) (gratuita)
- Repositório GitHub com o código atualizado
- URL WebSocket RPC da Scroll Sepolia (Alchemy ou Infura)
- Endereço do contrato inteligente implantado

## 🔄 Alterações Necessárias (Já Implementadas)

### 1. **package.json**
Adicionados scripts para produção:
- `postinstall`: Gera automaticamente o cliente Prisma após instalação
- `start:indexer`: Inicia o indexer como background worker

### 2. **render.yaml**
Arquivo de configuração que define:
- **Web Service**: API Next.js (porta 3000)
- **Worker Service**: Indexer de eventos do contrato
- **Database**: PostgreSQL gratuito

### 3. **prisma/schema.prisma**
Alterado de SQLite para PostgreSQL (necessário para produção no Render)

### 4. **next.config.ts**
CORS configurado para usar variável de ambiente `FRONTEND_URL` em produção

### 5. **lib/indexer.ts**
Ajustado para não carregar `.env` em produção (Render injeta variáveis automaticamente)

### 6. **pages/api/health.ts**
Novo endpoint para verificar saúde do serviço e conexão com banco de dados

## 🚀 Processo de Deploy

### Passo 1: Preparar o Repositório

1. Faça commit e push de todas as alterações:
```bash
git add .
git commit -m "Preparar projeto para deploy no Render"
git push origin main
```

### Passo 2: Criar Serviços no Render

#### Opção A: Deploy via Blueprint (Recomendado)

1. Faça login no [Render Dashboard](https://dashboard.render.com)
2. Clique em **"New"** → **"Blueprint"**
3. Conecte seu repositório GitHub
4. O Render detectará automaticamente o `render.yaml`
5. Clique em **"Apply"**

#### Opção B: Deploy Manual

**2.1. Criar o Banco de Dados PostgreSQL**
1. No Render Dashboard, clique em **"New"** → **"PostgreSQL"**
2. Configure:
   - **Name**: `loom-db`
   - **Database**: `loom`
   - **Region**: Oregon (ou mais próximo de você)
   - **Plan**: Free
3. Clique em **"Create Database"**
4. Copie a **Internal Database URL** (será usada nos próximos passos)

**2.2. Criar o Web Service (API)**
1. Clique em **"New"** → **"Web Service"**
2. Conecte seu repositório GitHub
3. Configure:
   - **Name**: `loom-backend-api`
   - **Region**: Oregon
   - **Branch**: `main`
   - **Runtime**: Node
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
4. Adicione as variáveis de ambiente (ver seção abaixo)
5. Clique em **"Create Web Service"**

**2.3. Criar o Background Worker (Indexer)**
1. Clique em **"New"** → **Background Worker**
2. Conecte o mesmo repositório
3. Configure:
   - **Name**: `loom-backend-indexer`
   - **Region**: Oregon
   - **Branch**: `main`
   - **Runtime**: Node
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm run start:indexer`
4. Adicione as mesmas variáveis de ambiente
5. Clique em **"Create Background Worker"**

### Passo 3: Configurar Variáveis de Ambiente

Configure estas variáveis em **AMBOS** os serviços (API e Indexer):

| Variável | Valor | Como Obter |
|----------|-------|------------|
| `DATABASE_URL` | `postgresql://user:password@host:5432/database` | Copie a "Internal Database URL" do PostgreSQL criado no Render |
| `SCROLL_SEPOLIA_WSS_RPC_URL` | `wss://scroll-sepolia.g.alchemy.com/v2/YOUR-API-KEY` | Obtenha no [Alchemy Dashboard](https://dashboard.alchemy.com) ou Infura |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0x...` | Endereço do seu contrato implantado (do AppContrato) |
| `FRONTEND_URL` | `https://seu-frontend.vercel.app` | URL do seu frontend em produção (opcional) |
| `NODE_ENV` | `production` | Já configurado automaticamente pelo Render |

**Como adicionar variáveis:**
1. Vá para o serviço no Render Dashboard
2. Clique em **"Environment"** no menu lateral
3. Clique em **"Add Environment Variable"**
4. Adicione cada variável e seu valor
5. Clique em **"Save Changes"**

### Passo 4: Criar e Executar Migrações do Prisma

O Prisma usa um sistema de migrações para gerenciar o schema do banco de dados. Como você está mudando de SQLite (desenvolvimento) para PostgreSQL (produção), precisará criar novas migrações.

#### 4.1. Preparar Migrações Localmente (Antes do Deploy)

**Opção A: Se você já tem migrações do SQLite**

1. Apague a pasta de migrações antiga:
```bash
rm -rf prisma/migrations
```

2. Crie uma nova migração inicial para PostgreSQL:
```bash
# Configure temporariamente para usar PostgreSQL local ou o do Render
# Copie a DATABASE_URL do Render e cole no .env temporariamente
DATABASE_URL="postgresql://user:password@host:5432/database" npx prisma migrate dev --name init
```

3. Faça commit das novas migrações:
```bash
git add prisma/migrations
git commit -m "Adicionar migrações para PostgreSQL"
git push origin main
```

**Opção B: Deixar o Render criar as tabelas diretamente (Mais Simples)**

Se você não quer lidar com migrações locais, pode usar `prisma db push` no Render após o deploy.

#### 4.2. Executar Migrações no Render (Após Deploy)

Após o primeiro deploy bem-sucedido:

1. Vá para o **Web Service** (`loom-backend-api`) no Render Dashboard
2. Clique em **"Shell"** no menu lateral (abrirá um terminal web)
3. Execute um dos comandos:

**Se você criou migrações (Opção A):**
```bash
npx prisma migrate deploy
```

**Se você não tem migrações (Opção B - Recomendado para primeiro deploy):**
```bash
npx prisma db push
```

4. Verifique se as tabelas foram criadas:
```bash
npx prisma db pull
```

Isso criará as tabelas no banco de dados PostgreSQL.

> **💡 Dica:** O comando `prisma db push` sincroniza o schema diretamente sem criar arquivos de migração. É mais rápido para o primeiro deploy, mas `prisma migrate deploy` é melhor para produção a longo prazo.

### Passo 5: Verificar o Deploy

1. **Verificar API**: Acesse `https://loom-backend-api.onrender.com/api/health`
   - Deve retornar: `{"status": "healthy", "database": "connected"}`

2. **Verificar Logs do Indexer**:
   - No Render Dashboard, vá para o Worker (`loom-backend-indexer`)
   - Clique em **"Logs"**
   - Você deve ver: `[Indexer] Ouvindo eventos da blockchain...`

3. **Testar API de Jobs**:
   - `https://loom-backend-api.onrender.com/api/jobs/open` - Lista jobs abertos
   - `https://loom-backend-api.onrender.com/api/jobs/my?address=0x...` - Jobs do usuário

## 🔧 Comandos Úteis

### No Shell do Render:

```bash
# Ver status das migrações
npx prisma migrate status

# Resetar banco (CUIDADO: apaga todos os dados)
npx prisma migrate reset

# Ver dados no Prisma Studio
npx prisma studio
```

### Localmente (testar antes do deploy):

```bash
# Testar build de produção
npm run build
npm start

# Mudar para PostgreSQL local (opcional)
# 1. Instalar PostgreSQL localmente
# 2. Atualizar .env:
DATABASE_URL="postgresql://user:password@localhost:5432/loom_dev"

# 3. Criar migrações
npx prisma migrate dev --name init
```

### Workflow de Migrações (Após Primeiro Deploy):

```bash
# 1. Alterar o schema.prisma localmente
# 2. Criar migração
npx prisma migrate dev --name descricao_da_mudanca

# 3. Commitar e fazer push
git add prisma/migrations
git commit -m "Adicionar migração: descricao_da_mudanca"
git push origin main

# 4. O Render fará redeploy automático
# 5. As migrações serão aplicadas automaticamente se você adicionar ao build command
```

**Para aplicar migrações automaticamente no Render**, atualize o `render.yaml`:
```yaml
buildCommand: npm install && npx prisma generate && npx prisma migrate deploy && npm run build
```

## 📊 Monitoramento

### Logs em Tempo Real
- **API**: Render Dashboard → `loom-backend-api` → Logs
- **Indexer**: Render Dashboard → `loom-backend-indexer` → Logs

### Métricas
O Render fornece automaticamente:
- Uptime
- CPU e memória
- Requisições HTTP (para Web Service)
- Tempo de resposta

### Alertas
Configure no Render Dashboard → Serviço → Settings → Notifications

## ⚠️ Limitações do Plano Free

- **Web Service**: Dorme após 15 minutos de inatividade
  - Primeira requisição após inatividade pode levar ~30 segundos
- **Background Worker**: Também pode dormir se não estiver processando
- **PostgreSQL**: 
  - 1 GB de armazenamento
  - Limitado a 1 banco de dados
  - Expira após 90 dias de inatividade

### Upgrade Recomendado para Produção

Se seu projeto for para produção real, considere:
- **Starter Plan ($7/mês por serviço)**: Sem hibernação
- **PostgreSQL Standard ($7/mês)**: Mais armazenamento e performance

## 🔄 Atualizações e CI/CD

O Render automaticamente:
1. Detecta novos commits no branch `main`
2. Faz rebuild e redeploy dos serviços
3. Executa os comandos de build automaticamente

Para desabilitar auto-deploy:
- Render Dashboard → Serviço → Settings → Auto-Deploy → OFF

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"
- Verifique se a `DATABASE_URL` está correta
- Confirme que o PostgreSQL está ativo no Render
- Execute `npx prisma migrate deploy` no Shell

### Erro: "SCROLL_SEPOLIA_WSS_RPC_URL not defined"
- Verifique se a variável está configurada TANTO no Web Service quanto no Worker
- Confirme que é uma URL WebSocket (começa com `wss://`)

### Indexer não está capturando eventos
- Verifique os logs do Worker
- Confirme que o `NEXT_PUBLIC_CONTRACT_ADDRESS` está correto
- Teste a conexão WebSocket localmente primeiro

### Build falha no Render
- Verifique se todos os arquivos foram commitados
- Confirme que `package.json` está correto
- Veja os logs de build no Render para detalhes

### API retorna erro 503 no /health
- Banco de dados pode não estar conectado
- Execute migrações: `npx prisma migrate deploy`
- Verifique logs do serviço

## 📞 Recursos Adicionais

- [Documentação do Render](https://render.com/docs)
- [Documentação do Prisma](https://www.prisma.io/docs)
- [Suporte do Render](https://render.com/support)

## ✅ Checklist Final

Antes de considerar o deploy completo:

- [ ] Repositório atualizado no GitHub
- [ ] PostgreSQL criado no Render
- [ ] Web Service (API) criado e rodando
- [ ] Background Worker (Indexer) criado e rodando
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Migrações executadas (`prisma migrate deploy`)
- [ ] Endpoint `/api/health` retorna `healthy`
- [ ] Logs do Indexer mostram "Ouvindo eventos"
- [ ] Testado pelo menos um endpoint de API
- [ ] Frontend atualizado com nova URL da API

## 🎉 Pronto!

Seu backend está agora rodando no Render! 

**URLs importantes:**
- API: `https://loom-backend-api.onrender.com`
- Health Check: `https://loom-backend-api.onrender.com/api/health`
- Render Dashboard: `https://dashboard.render.com`

Não esqueça de atualizar o frontend com a nova URL da API!
