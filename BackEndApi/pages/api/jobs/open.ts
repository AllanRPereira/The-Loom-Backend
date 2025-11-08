// app/pages/api/jobs/open.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const openJobs = await prisma.job.findMany({
      where: {
        status: "Open",
      },
      orderBy: {
        id: "desc",
      },
    });
    res.status(200).json(openJobs);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar jobs" });
  }
}