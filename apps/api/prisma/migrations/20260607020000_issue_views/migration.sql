-- CreateTable
CREATE TABLE "issue_views" (
    "id" TEXT NOT NULL,
    "project_slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "display_options" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_views_project_slug_name_idx" ON "issue_views"("project_slug", "name");

-- AddForeignKey
ALTER TABLE "issue_views" ADD CONSTRAINT "issue_views_project_slug_fkey" FOREIGN KEY ("project_slug") REFERENCES "projects"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
