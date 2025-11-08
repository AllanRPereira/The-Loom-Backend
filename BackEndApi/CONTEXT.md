# Relatório de Contexto: Projeto de Marketplace de GPU (DePIN)

## 1. Visão Geral do Projeto

O objetivo deste projeto é construir uma plataforma de **Computação Descentralizada (DePIN)** para um hackathon patrocinado pela **Chainlink**, **Scroll** e **Ethereum Foundation**.

O conceito central é um "Airbnb para GPUs":
* **Clientes (Requisitantes):** Submetem cargas de trabalho (ex: treinamento de IA) e depositam uma recompensa em um smart contract.
* **Provedores:** Pessoas com GPUs ociosas que executam esses trabalhos e reivindicam a recompensa.

## 2. Arquitetura Final do DApp

O projeto evoluiu de um simples script de API para um DApp full-stack completo, desacoplado em três componentes principais:

1.  **Smart Contract (Solidity):** A "lógica de negócios" e o "banco" seguros, deployados na **Scroll Sepolia**.
2.  **Backend (Next.js + Prisma):** Atua como um serviço de "leitura" (cache/indexer). Ele ouve a blockchain, salva os dados em um banco de dados local (SQLite) e fornece uma API de leitura rápida para o frontend.
3.  **Frontend (Next.js + React):** A interface do usuário (DApp). É responsável por todas as transações de "escrita" (interagindo com o MetaMask do usuário) e pela exibição dos dados lidos do Backend.

---

## 3. Componentes Chave Detalhados

### 3.1. Smart Contract (`JobManager.sol`)

* **Rede:** Scroll Sepolia.
* **Funções Principais:**
    * `postJob(string dataUrl, string scriptUrl, uint26 rewardUsd)`: Chamada pelo Cliente. O `value` (em ETH) é calculado e enviado pelo frontend.
    * `acceptJob(uint26 jobId)`: Chamada pelo Provedor (modelo FCFS - First-Come, First-Served).
    * `submitResult(uint26 jobId, string resultUrl)`: Chamada pelo Provedor.
    * `approveAndPay(uint26 jobId)`: Chamada pelo Cliente para liberar o pagamento.
* **Integração (Chainlink):**
    * Usa os **Chainlink Price Feeds** (`ETH/USD`).
    * A função `convertUsdToEth` permite que os Clientes postem recompensas em USD, melhorando a UX.
* **Armazenamento de Dados (IPFS):**
    * O contrato **não** armazena dados pesados. Ele apenas armazena URLs do **IPFS** para `dataUrl` (o dataset) e `scriptUrl` (o script de execução).

### 3.2. Backend (Indexer & Read-API)

* **Stack:** Next.js, `ts-node`, Prisma, SQLite, Ethers.js.
* **Componente 1: O Indexer (`lib/indexer.ts`)**
    * **Objetivo:** Ouvir eventos da blockchain 24/7 e popular o banco de dados SQLite.
    * **Conexão:** Requer um nó RPC dedicado (como **Alchemy**), pois o nó público da Scroll bloqueia o método `eth_newFilter` (`contract.on`).
    * **Eventos Monitorados:** `JobPosted`, `JobAccepted`, `JobResultSubmitted`, `JobApproved`.
    * **Lógica Crítica:** Todos os endereços (`requester`, `provider`) são salvos no banco de dados usando `.toLowerCase()` para evitar erros de comparação de string (Checksum vs. minúsculas).
* **Componente 2: O Banco de Dados (Prisma + SQLite)**
    * **Schema:** `model Job` espelha o `struct Job` do contrato, incluindo `id`, `status`, `requester`, `provider`, `dataUrl`, `scriptUrl`, `resultUrl`, etc.
* **Componente 3: A API de Leitura (`pages/api/...`)**
    * **Objetivo:** Fornecer dados *rápidos* (e cacheados) para o frontend, evitando que o frontend tenha que consultar a blockchain diretamente.
    * **Endpoints:**
        * `GET /api/jobs/open`: Retorna todos os jobs com `status: "Open"`.
        * `GET /api/jobs/my?userAddress=...`: Retorna todos os jobs onde o endereço (convertido para minúsculas) é o `requester` OU o `provider`.

### 3.3. Frontend (O DApp)

* **Stack:** Next.js, React, Ethers.js.
* **Gerenciamento de Transações:** O frontend é o **único** responsável por transações de *escrita*. Ele usa `new ethers.BrowserProvider(window.ethereum)` para se conectar ao MetaMask do usuário e obter o `signer`.
* **Páginas:**
    * **`pages/cliente.tsx`:**
        * Conecta a carteira e verifica se a rede está correta (Scroll Sepolia).
        * Renderiza um formulário para chamar `contract.postJob(...)`.
        * Faz `fetch` na API `/api/jobs/my` para listar os jobs postados.
        * Renderiza um botão "Aprovar Pagamento" (chamando `contract.approveAndPay`) para jobs com `status: "PendingApproval"`.
    * **`pages/provedor.tsx`:**
        * Conecta a carteira e verifica a rede.
        * Faz `fetch` na API `/api/jobs/open` para listar jobs do mercado.
        * Faz `fetch` na API `/api/jobs/my` para listar seus próprios trabalhos.
        * Renderiza um botão "Aceitar Job" (`contract.acceptJob`).
        * Renderiza um formulário "Enviar Resultado" (`contract.submitResult`) para jobs com `status: "InProgress"`.
* **Lógica Crítica:**
    * O DApp usa dois perfis/navegadores separados para testar o fluxo Cliente-Provedor.
    * As comparações de endereço no filtro do frontend (ex: `myJobs.filter(...)`) também usam `.toLowerCase()` para garantir consistência.

---

## 4. Histórico de Decisões Críticas (Pivots)

1.  **Pivot de Integração (Chainlink):**
    * **Ideia Inicial:** Usar **Chainlink VRF** para seleção "justa" de provedores.
    * **Problema:** Foi descoberto que o VRF não estava disponível na Scroll Sepolia.
    * **Solução:** Mudamos para **Chainlink Price Feeds**. Isso sacrificou a "justiça" da seleção (agora FCFS), mas adicionou uma funcionalidade de UX muito valiosa (preços em USD).
2.  **Pivot de Arquitetura (Backend):**
    * **Ideia Inicial:** Uma API de backend que guardava chaves privadas no `.env` para testar o contrato.
    * **Problema:** Isso não é um DApp e não é seguro ou descentralizado.
    * **Solução:** A arquitetura foi dividida. O backend perdeu as chaves privadas e se tornou um "Indexer" (leitura), enquanto o Frontend (MetaMask) assumiu 100% da responsabilidade pelas "escritas".
3.  **Pivot de Lógica de Dados (Armazenamento de Script):**
    * **Ideia Inicial:** Adicionar um `scriptUrl` (para instruções da GPU) além do `dataUrl`.
    * **Problema:** Onde armazenar o script? Blockchain (caro) ou Backend (centralizado)?
    * **Solução:** Usar o padrão **IPFS** para o `scriptUrl`, assim como já era feito para o `dataUrl`. Isso manteve o custo de gás baixo e a arquitetura descentralizada.

## 5. Desafios Técnicos Críticos (Bugs Resolvidos)

* **Configuração do Hardhat:** Ocorreram conflitos entre o `hardhat v3` (padrão) e o `hardhat-toolbox` (que esperava o v2). Resolvido forçando a instalação do `hardhat@^2.26.0`.
* **Erro do Indexer: `Method disabled`**
    * **Causa:** O `contract.on(...)` (que usa `eth_newFilter`) não é suportado pelo nó RPC público da Scroll (`sepolia-rpc.scroll.io`).
    * **Solução:** O projeto migrou para um RPC dedicado da **Alchemy**, que suporta conexões persistentes (WebSockets).
* **Bug do Endereço (O Bug Mais Crítico):**
    * **Sintoma:** O Provedor aceitava um job, o status mudava para `InProgress`, mas o job não aparecia na sua lista de "Meus Trabalhos Ativos".
    * **Causa:** Incompatibilidade de *case* (maiúsculas/minúsculas). O MetaMask fornecia endereços com Checksum (ex: `0xAbC...`) enquanto o Indexer salvava endereços em minúsculas (ex: `0xabc...`). A consulta da API (`prisma.job.findMany`) falhava.
    * **Solução:** **Normalização.** Todos os endereços foram convertidos para `.toLowerCase()` no **Indexer** (antes de salvar no DB) e na **API de Leitura** (antes de consultar o DB).
* **Bugs do Prisma (`@prisma/client did not initialize`):**
    * **Causa 1:** O `npx prisma migrate` (que atualiza o DB) e o `npx prisma generate` (que atualiza o *código* do cliente) são comandos separados. O `generate` estava sendo esquecido após as mudanças no schema.
    * **Causa 2:** O `indexer.ts` (rodando com `ts-node`) e o Next.js (`npm run dev`) liam arquivos `.env` de forma diferente, causando falhas na migração.
* **Bugs do Frontend (`.filter is not a function`):**
    * **Causa:** A API estava falhando (devido ao bug do Prisma acima) e retornando um *objeto* de erro (`{ message: ... }`), mas o frontend esperava um *Array*.
    * **Solução:** 1) Corrigir a falha do Prisma. 2) Tornar o frontend "defensivo", checando se a resposta da API foi `response.ok` e `Array.isArray(data)`.
* **Bugs de Módulo ES (`__dirname is not defined`):**
    * **Causa:** O `indexer.ts` (rodando com `ts-node`) é um Módulo ES, que não tem `__dirname`.
    * **Solução:** Usar o padrão `import.meta.url` e `fileURLToPath` para recriar o `__dirname` e ler o arquivo ABI via `fs.readFileSync`.