-- CreateTable
CREATE TABLE "teams" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "workflow_states" (
    "id" TEXT NOT NULL,
    "team_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_states_team_key_name_key" ON "workflow_states"("team_key", "name");

-- CreateIndex
CREATE INDEX "workflow_states_team_key_position_idx" ON "workflow_states"("team_key", "position");

-- AddForeignKey
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_team_key_fkey" FOREIGN KEY ("team_key") REFERENCES "teams"("key") ON DELETE CASCADE ON UPDATE CASCADE;
