import { defineConfig } from '@neon/config/v1';

export default defineConfig({
  // Declare your Neon services here
  auth: true,
  functions: {
    api: {
      name: 'Tenggat API',
      source: './functions/api.ts',
      env: {
        VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY!,
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY!,
        VAPID_SUBJECT: process.env.VAPID_SUBJECT!,
      },
    },
    remind: {
      name: 'Daily reminder',
      source: './functions/remind.ts',
      env: {
        VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY!,
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY!,
        VAPID_SUBJECT: process.env.VAPID_SUBJECT!,
      },
    },
  },
  triggers: {
    'daily-reminder': {
      type: 'schedule',
      function: 'remind',
      cron: '0 1 * * *',
    },
  },
  buckets: {
    // "private" is the default; use "public_read" for anonymous reads
    assets: { access: 'private' },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: '7d' };
    }
    // Existing branch: no changes
    return {};
  },
});

