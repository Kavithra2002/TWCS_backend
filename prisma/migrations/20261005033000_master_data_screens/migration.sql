-- Screens, the views that belong to them, and which users are assigned each screen.
CREATE TABLE "Screen" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Screen_code_key" ON "Screen"("code");

CREATE TABLE "ScreenView" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScreenView_screenId_code_key" ON "ScreenView"("screenId", "code");
CREATE INDEX "ScreenView_screenId_idx" ON "ScreenView"("screenId");

ALTER TABLE "ScreenView" ADD CONSTRAINT "ScreenView_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserScreen" (
    "userId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserScreen_pkey" PRIMARY KEY ("userId", "screenId")
);

CREATE INDEX "UserScreen_screenId_idx" ON "UserScreen"("screenId");

ALTER TABLE "UserScreen" ADD CONSTRAINT "UserScreen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserScreen" ADD CONSTRAINT "UserScreen_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
