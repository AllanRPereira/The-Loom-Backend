// pages/api/jobs/[id]/prepare-action.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from "@prisma/client";
import { getReadonlyContract } from '../../../../lib/ethers-service';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { hash } = req.query;
  const { action, resultUrl } = req.body; // action: 'accept' | 'submit' | 'approve'

  if (!action) {
    return res.status(400).json({ message: 'Action type is required' });
  }

  try {
    const contract = getReadonlyContract();
    const txHash = String(hash);
    
    const job = await prisma.job.findFirst({
      where: { txHash: txHash },
      select: { id: true }
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const jobId = job.id;

    let txData: string;

    // Codifica os dados da transação com base na ação solicitada
    switch (action) {
      case 'accept':
        txData = contract.interface.encodeFunctionData('acceptJob', [jobId]);
        break;

      case 'submit':
        if (!resultUrl) {
          return res.status(400).json({ message: 'resultUrl is required for submit action' });
        }
        txData = contract.interface.encodeFunctionData('submitResult', [jobId, resultUrl]);
        break;

      case 'approve':
        txData = contract.interface.encodeFunctionData('approveAndPay', [jobId]);
        break;

      default:
        return res.status(400).json({ message: 'Invalid action type' });
    }

    // Retorna o objeto de transação para o frontend (sem valor, pois essas txs não pagam ETH)
    res.status(200).json({
      to: await contract.getAddress(),
      data: txData,
    });

  } catch (error: any) {
    console.error(`Error preparing ${action} transaction for job #${hash}:`, error);
    res.status(500).json({ message: 'Error preparing transaction', error: error.message });
  }
}
