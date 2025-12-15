import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
console.log("SUPABASE_URL =", process.env.SUPABASE_URL);

export const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
