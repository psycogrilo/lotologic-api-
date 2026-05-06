-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "anchors" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "suggestedNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "DrawResult" (
    "id" TEXT NOT NULL,
    "lottery" TEXT NOT NULL,
    "concurso" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "numbers" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrawResult_lottery_idx" ON "DrawResult"("lottery");

-- CreateIndex
CREATE UNIQUE INDEX "DrawResult_lottery_concurso_key" ON "DrawResult"("lottery", "concurso");
