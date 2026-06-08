# Supabase Setup Instructions

You are seeing this error because the database table to store your website images hasn't been created yet! 

Please follow these exact steps to create the database table and the storage bucket:

### Step 1: Create the Database Table
1. Go to your Supabase project dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. In the left sidebar, click on **SQL Editor** (the icon looks like a `>_` terminal).
3. Click **New Query** to open a blank editor.
4. Copy and paste the following SQL code exactly as it is:

```sql
-- Create the table
create table public.site_content (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  image_url text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Security (Row Level Security)
alter table public.site_content enable row level security;

-- Allow anyone to read the images
create policy "Public Access"
  on public.site_content for select
  using ( true );

-- Allow logged in admin users to update/insert images
create policy "Admin Write Access"
  on public.site_content for all
  using ( auth.role() = 'authenticated' );
```
5. Click the **RUN** button (or press `Cmd/Ctrl + Enter`). You should see a success message!

### Step 2: Create the Storage Bucket
1. In the left sidebar of Supabase, click on **Storage** (the folder icon).
2. Click **New Bucket**.
3. Name the bucket exactly: `website-images` (all lowercase, with a dash).
4. **CRITICAL**: Make sure the **"Public bucket"** toggle is turned **ON**.
5. Click **Save**.
6. Once the bucket is created, click on it, go to the **Policies** tab at the top.
7. Under "Policies under website-images", click **New Policy** -> **For Full Customization**.
8. Name it `Allow All`
9. For ALLOWED OPERATIONS, check **SELECT**, **INSERT**, **UPDATE**, and **DELETE**.
10. Click **Review** and then **Save policy**.

Once you have done both steps, refresh your Admin Dashboard and the images will load perfectly!
