// pages/api/jobs/prepare-post.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getReadonlyContract } from '../../../lib/ethers-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { dataUrl, scriptUrl, usdAmount } = req.body;

  if (!dataUrl || !scriptUrl || !usdAmount) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const contract = getReadonlyContract();
    const rewardUsd = BigInt(parseFloat(usdAmount) * 10 ** 8);

    // 1. Chamar a função read-only para calcular o valor em ETH
    const requiredEth = await contract.convertUsdToEth(rewardUsd);

    // 2. Codificar os dados da chamada de função para a transação
    const txData = contract.interface.encodeFunctionData('postJob', [
      dataUrl,
      scriptUrl,
      rewardUsd,
    ]);

    // 3. Retornar o objeto de transação para o frontend
    res.status(200).json({
      to: await contract.getAddress(),
      value: requiredEth.toString(),
      data: txData,
    });

  } catch (error: any) {
    console.error('Error preparing postJob transaction:', error);
    res.status(500).json({ message: 'Error preparing transaction', error: error.message });
  }
}
