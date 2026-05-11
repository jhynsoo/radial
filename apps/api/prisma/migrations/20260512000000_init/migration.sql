-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "project_counters" (
    "key" TEXT NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_counters_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "project_slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER,
    "state" TEXT NOT NULL,
    "branch_name" TEXT,
    "url" TEXT,
    "assignee" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_labels" (
    "issue_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "issue_labels_pkey" PRIMARY KEY ("issue_id", "label")
);

-- CreateTable
CREATE TABLE "issue_blockers" (
    "issue_id" TEXT NOT NULL,
    "blocker_issue_id" TEXT NOT NULL,

    CONSTRAINT "issue_blockers_pkey" PRIMARY KEY ("issue_id", "blocker_issue_id")
);

-- CreateTable
CREATE TABLE "issue_external_blockers" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "state" TEXT,

    CONSTRAINT "issue_external_blockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_comments" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_links" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_relations" (
    "id" TEXT NOT NULL,
    "source_issue_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "target_issue_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issues_project_slug_identifier_key" ON "issues"("project_slug", "identifier");

-- CreateIndex
CREATE INDEX "issues_project_slug_state_idx" ON "issues"("project_slug", "state");

-- CreateIndex
CREATE INDEX "issue_comments_issue_id_resolved_idx" ON "issue_comments"("issue_id", "resolved");

-- CreateIndex
CREATE INDEX "issue_links_issue_id_idx" ON "issue_links"("issue_id");

-- CreateIndex
CREATE INDEX "issue_relations_source_issue_id_idx" ON "issue_relations"("source_issue_id");

-- CreateIndex
CREATE INDEX "issue_relations_target_issue_id_idx" ON "issue_relations"("target_issue_id");

-- AddForeignKey
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_blockers" ADD CONSTRAINT "issue_blockers_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_blockers" ADD CONSTRAINT "issue_blockers_blocker_issue_id_fkey" FOREIGN KEY ("blocker_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_external_blockers" ADD CONSTRAINT "issue_external_blockers_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_source_issue_id_fkey" FOREIGN KEY ("source_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_target_issue_id_fkey" FOREIGN KEY ("target_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
