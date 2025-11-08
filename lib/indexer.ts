// app/lib/indexer.ts
import * as dotenv from 'dotenv';

// Em produção, o Render já injeta as variáveis de ambiente
if (process.env.NODE_ENV !== 'production') {
  dotenv.config(); // Carrega o arquivo .env padrão apenas em desenvolvimento
}

import { ethers } from "ethers";
// Esta importação agora funcionará após o 'prisma generate'
import { PrismaClient } from "@prisma/client"; 
import fs from "fs";
import path from "path";
// Sua correção correta para __dirname em ESM:
import { fileURLToPath } from "url";

// --- Início da Correção do __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- Fim da Correção ---

// 3. Construa o caminho para o arquivo ABI
const abiPath = path.resolve(
  __dirname, // Agora esta variável existe
  "./JobManager.json"
);

// 4. Leia o arquivo e faça o parse (análise) do JSON
const abiFile = fs.readFileSync(abiPath, "utf8");
const JobManagerABI = JSON.parse(abiFile);

// Configurações
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const WSS_RPC_URL = process.env.SCROLL_SEPOLIA_WSS_RPC_URL!;

if (!WSS_RPC_URL) {
  throw new Error("SCROLL_SEPOLIA_WSS_RPC_URL não está definida no arquivo .env. É necessária para o indexer.");
}

const prisma = new PrismaClient();

// Usamos um WebSocketProvider para uma conexão persistente e estável com o nó.
console.log(`[Indexer] Conectando via WebSocket a: ${WSS_RPC_URL.split('/').slice(0, 3).join('/')}`)
const provider = new ethers.WebSocketProvider(WSS_RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, JobManagerABI.abi, provider);

// Mapeamento de Status (Enum do Solidity)
const STATUS_MAP = ["Open", "InProgress", "PendingApproval", "Completed", "Cancelled"];

async function main() {
  console.log(`[Indexer] Conectado ao contrato: ${CONTRACT_ADDRESS}`);
  console.log(`[Indexer] Ouvindo eventos da blockchain...`);

  // --- Ouvinte de Evento: JobPosted ---
  contract.on("JobPosted", async (jobId, requester, rewardUsd, rewardEth, dataUrl, scriptUrl, event) => {
    const id = Number(jobId);
    const txHash = event.log.transactionHash;
    console.log(`[Evento] JobPosted: #${id} tx=${txHash}`);
    try {
      // Exemplo: buscar a transação completa, se precisar
      // const tx = await provider.getTransaction(txHash);

      // Precisamos buscar o dataUrl, pois ele não está no evento
      const job = await contract.s_jobs(id);

      await prisma.job.create({
        data: {
          id: id,
          status: "Open",
          requester: requester.toLowerCase(),
          dataUrl: dataUrl,
          scriptUrl: scriptUrl,
          rewardUsd: rewardUsd.toString(),
          rewardEth: rewardEth.toString(),
          txHash: txHash,
        },
      });
    } catch (e) {
      console.error(`[Erro Indexer] JobPosted #${id}:`, e);
    }
  });

  // --- Ouvinte de Evento: JobAccepted ---
  contract.on("JobAccepted", async (jobId, providerAddr, event) => {
    const id = Number(jobId);
    const txHash = event.log.transactionHash;
    console.log(`[Evento] JobAccepted: #${id} por ${providerAddr} tx=${txHash}`);
    try {
      await prisma.job.update({
        where: { id: id },
        data: {
          status: "InProgress",
          provider: providerAddr.toLowerCase(),
        },
      });
    } catch (e) {
      console.error(`[Erro Indexer] JobAccepted #${id}:`, e);
    }
  });

  // --- Ouvinte de Evento: JobResultSubmitted ---
  contract.on("JobResultSubmitted", async (jobId, providerAddr, resultUrl, event) => {
    const id = Number(jobId);
    console.log(`[Evento] JobResultSubmitted: #${id}`);
    try {
      await prisma.job.update({
        where: { id: id },
        data: {
          status: "PendingApproval",
          resultUrl: resultUrl,
        },
      });
    } catch (e) {
      console.error(`[Erro Indexer] JobResultSubmitted #${id}:`, e);
    }
  });

  // --- Ouvinte de Evento: JobApproved ---
  contract.on("JobApproved", async (jobId, event) => {
    const id = Number(jobId);
    console.log(`[Evento] JobApproved: #${id}`);
    try {
      await prisma.job.update({
        where: { id: id },
        data: {
          status: "Completed",
        },
      });
    } catch (e) {
      console.error(`[Erro Indexer] JobApproved #${id}:`, e);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
