import type { DashboardConfig } from '@/types/dashboard';

const config: DashboardConfig = {
  "clientId": "af9e843b75a75d0cd6527844ec3dfe39",
  "clientName": "The Rest of the Story Consignment",
  "clientDomain": "therestofthestory.store",
  "clientEmail": "info@therestofthestory.store",
  "enabledWidgets": [
    "links",
    "siteAnalytics"
  ],
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
    "stripeCustomerId": "cus_UtaADwJUbdecTd",
    "showPendingCharges": true,
    "showOfflineInvoices": true
  },
  "analytics": {
    "provider": "simple-analytics",
    "simpleAnalyticsId": "therestofthestory.store",
    "internalRoutes": [
      "/analytics",
      "/billing",
      "/support"
    ],
    "conversionPage": "/contact"
  }
};

export default config;
