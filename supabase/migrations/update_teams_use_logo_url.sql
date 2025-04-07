/*
  # Update teams table to use logoUrl

  This migration replaces the `logoIconName` column with a `logoUrl` column to store image URLs for team logos.

  1.  **Schema Changes:**
      - Adds a new column `logoUrl` (text) to the `teams` table.
      - Removes the old column `logoIconName` from the `teams` table.

  2.  **Data Updates:**
      - Populates the new `logoUrl` column with placeholder URLs for existing teams before making it non-nullable.
      - **Important:** These are placeholder URLs. You should update them with actual logo URLs later.

  3.  **Constraints:**
      - Makes the `logoUrl` column `NOT NULL`.

  4.  **Comments:**
      - Updates column comments.
*/

-- Step 1: Add the new logoUrl column (allow nulls initially)
ALTER TABLE public.teams ADD COLUMN "logoUrl" text;
COMMENT ON COLUMN public.teams."logoUrl" IS 'URL of the team logo image';

-- Step 2: Populate the new column with placeholder URLs for existing rows
-- You should replace these with actual URLs!
UPDATE public.teams SET "logoUrl" = 'https://via.placeholder.com/64.png?text=' || name WHERE "logoUrl" IS NULL;

-- Step 3: Make the new column NOT NULL
-- This assumes all existing rows were updated in Step 2
ALTER TABLE public.teams ALTER COLUMN "logoUrl" SET NOT NULL;

-- Step 4: Drop the old logoIconName column
ALTER TABLE public.teams DROP COLUMN "logoIconName";