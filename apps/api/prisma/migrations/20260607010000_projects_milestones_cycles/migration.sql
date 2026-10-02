-- CreateTable
CREATE TABLE "projects" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" TEXT NOT NULL,
    "project_slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_date" TIMESTAMP(3),
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" TEXT NOT NULL,
    "team_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "issues" ADD COLUMN "milestone_id" TEXT;
ALTER TABLE "issues" ADD COLUMN "cycle_id" TEXT;

-- CreateIndex
CREATE INDEX "project_milestones_project_slug_position_idx" ON "project_milestones"("project_slug", "position");

-- CreateIndex
CREATE INDEX "cycles_team_key_starts_at_idx" ON "cycles"("team_key", "starts_at");

-- CreateIndex
CREATE INDEX "issues_milestone_id_idx" ON "issues"("milestone_id");

-- CreateIndex
CREATE INDEX "issues_cycle_id_idx" ON "issues"("cycle_id");

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_slug_fkey" FOREIGN KEY ("project_slug") REFERENCES "projects"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_team_key_fkey" FOREIGN KEY ("team_key") REFERENCES "teams"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
