-- CreateTable
CREATE TABLE "Job" (
    "id" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "provider" TEXT,
    "dataUrl" TEXT NOT NULL,
    "scriptUrl" TEXT NOT NULL,
    "resultUrl" TEXT,
    "rewardUsd" TEXT NOT NULL,
    "rewardEth" TEXT NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);
