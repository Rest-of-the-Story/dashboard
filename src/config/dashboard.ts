import type { DashboardConfig } from '@/types/dashboard';

const config: DashboardConfig = {
  "clientId": "af9e843b75a75d0cd6527844ec3dfe39",
  "clientName": "The Rest of the Story Consignment",
  "clientDomain": "therestofthestory.store",
  "clientLogo": "https://cdn.sanity.io/images/xbjigamf/production/0630e3fe3b0a6043674e1c6cfa8069a7ed92db2c-249x259.svg",
  "clientEmail": "info@therestofthestory.store",
  // The overview's greeting and month-so-far card replaced the links and
  // analytics widgets; list optional extras ('tutorials', 'contentEditors') here.
  "enabledWidgets": [],
  "tutorialVideos": [],
  "links": [
    {
      "label": "Live Site",
      "url": "https://therestofthestory.store",
      "emoji": "🌐"
    },
    {
      "label": "Sanity Studio",
      "url": "https://studio.therestofthestory.store",
      "emoji": "✏️",
      "description": "Edit your content"
    }
  ],
  "contentEditors": [],
  "billing": {
    "enabled": true,
    "showPendingCharges": true,
    "showOfflineInvoices": true
  },
  "analytics": {
    "provider": "simple-analytics",
    "simpleAnalyticsId": "therestofthestory.store",
    "internalRoutes": [
      "/analytics",
      "/billing",
      "/support",
      "/blog-assist",
      "/reports"
    ],
    "conversionPage": "/contact",
    "trackingSince": "2025-06-17"
  }
};

export default config;
