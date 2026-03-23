import { type AuthConfig } from 'convex/server';

export default {
  providers: [
    {
      domain: "https://pro-urchin-71.clerk.accounts.dev",
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig;
