ALTER TABLE "Subscription"
  ADD COLUMN "providerEventId" TEXT,
  ADD COLUMN "providerEventCreatedAt" TIMESTAMP(3);

ALTER TABLE "Company" DROP CONSTRAINT "Company_userId_fkey";
ALTER TABLE "Company"
  ADD CONSTRAINT "Company_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
