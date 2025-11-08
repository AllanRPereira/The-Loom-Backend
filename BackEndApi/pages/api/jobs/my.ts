// app/pages/api/jobs/my.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userAddress } = req.query;
  const userAddressLower = (userAddress as string).toLowerCase();// ex: /api/jobs/my?userAddress=0x...

  if (!userAddress) {
    return res.status(400).json({ message: "userAddress é obrigatório" });
  }

  try {
    const myJobs = await prisma.job.findMany({
      where: {
        OR: [
          { requester: userAddressLower as string },
          { provider: userAddressLower as string },
        ],
      },
      orderBy: {
        id: "desc",
      },
    });
    res.status(200).json(myJobs);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar jobs" });
  }
}