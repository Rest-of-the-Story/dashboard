<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import DashboardLayout from '@/components/layout/DashboardLayout.vue';
import {
  LayoutDashboard,
  FileBarChart,
  BarChart3,
  Lightbulb,
  PenLine,
  PenSquare,
  CreditCard,
  MessageSquare,
  Video,
  LifeBuoy,
  ChevronDown,
} from 'lucide-vue-next';
import config from '@/config/dashboard';

/**
 * Help & How-To (docs/dashboard-help-page-handoff.md), written for what this
 * dashboard actually has: Monthly Reports as built here, Blog Assist, Zelle
 * billing, and a site that updates the moment something is published in the
 * Studio. Sections for features this client doesn't have are left out.
 */
const showBilling = Boolean(config.billing?.enabled);
const showTutorials = config.tutorialVideos.length > 0;
const studioUrl = config.links.find((l) => /studio|sanity/i.test(`${l.label} ${l.url}`))?.url;

const expanded = ref<Record<string, boolean>>({ overview: true });
const toggle = (key: string) => (expanded.value[key] = !expanded.value[key]);

const sections = [
  { key: 'overview', title: 'Overview (the home page)', icon: LayoutDashboard },
  { key: 'reports', title: 'Monthly Reports', icon: FileBarChart },
  { key: 'analytics', title: 'Analytics', icon: BarChart3 },
  { key: 'website', title: 'Edit Website', icon: PenSquare },
  { key: 'blog', title: 'Blog Assist', icon: Lightbulb },
  { key: 'content', title: 'Editing your website', icon: PenLine },
  ...(showBilling ? [{ key: 'billing', title: 'Billing', icon: CreditCard }] : []),
  { key: 'support', title: 'Contact & Support', icon: MessageSquare },
  ...(showTutorials ? [{ key: 'tutorials', title: 'Tutorial videos', icon: Video }] : []),
  { key: 'troubleshooting', title: 'Troubleshooting', icon: LifeBuoy },
];
</script>

<template>
  <DashboardLayout page-title="Help & How-To">
    <div class="help">
      <p class="help__intro">
        This page explains what each part of your dashboard does and how to use it. Still stuck? Send us a
        message from <RouterLink to="/support">Contact &amp; Support</RouterLink>; we aim to reply within one
        business day.
      </p>

      <section v-for="s in sections" :key="s.key" class="help__section">
        <h2 class="help__heading">
          <button
            type="button"
            class="help__header"
            :aria-expanded="Boolean(expanded[s.key])"
            :aria-controls="`help-${s.key}`"
            @click="toggle(s.key)"
          >
            <component :is="s.icon" :size="20" aria-hidden="true" />
            <span class="help__title">{{ s.title }}</span>
            <ChevronDown :size="18" class="help__chevron" :class="{ 'help__chevron--open': expanded[s.key] }" aria-hidden="true" />
          </button>
        </h2>

        <div v-show="expanded[s.key]" :id="`help-${s.key}`" class="help__body">
          <template v-if="s.key === 'overview'">
            <p>The page you land on after signing in, read from top to bottom:</p>
            <ul>
              <li><strong>Quick actions</strong>: view your website, edit its content in the Studio, or request a change from us.</li>
              <li><strong>Anything waiting on you</strong>, such as an unpaid invoice. When nothing is, you'll see "All caught up".</li>
              <li><strong>This month so far</strong>: visits since the 1st, compared with the same days last month, with a bar for each day. Today's bar is lighter because the day isn't over.</li>
              <li><strong>Last month's report</strong>: the headline numbers and a few sentences on how the month went. "Full report" opens it.</li>
              <li><strong>Site health</strong>: your homepage's scores in Google's speed and quality test, on a phone and on a computer.</li>
            </ul>
          </template>

          <template v-else-if="s.key === 'reports'">
            <p>A written snapshot of each finished month, kept so you can look back, print it or forward it.</p>
            <ul>
              <li><strong>When:</strong> each month's report is written early the following month, on the 3rd, once the month's figures have settled. It doesn't change after that.</li>
              <li><strong>What's in it:</strong> the month in brief, a note from us when we've written one, visits compared with the month before and the same month last year, Google's speed and quality test, your most viewed pages, and how people found the site.</li>
              <li><strong>Older months:</strong> use the Month menu at the top to look back.</li>
              <li><strong>Print or save as PDF</strong> gives you a clean two-page copy without the menus.</li>
            </ul>
            <p class="help__note">
              You never have to interpret a score on your own. If something in a report needs your attention, we'll say so in our note and usually reach out directly.
            </p>
          </template>

          <template v-else-if="s.key === 'analytics'">
            <p>Shows how many people are visiting your site and what they look at, for whichever period you pick.</p>
            <ul>
              <li><strong>Visitors</strong>: people who came to the site. Bots are left out, and no cookies are used.</li>
              <li><strong>Page views</strong>: pages opened. One visitor often opens several.</li>
              <li><strong>Top pages</strong>: what gets the most attention. Useful for deciding what to feature or expand.</li>
              <li><strong>Referrers</strong>: where visitors came from, such as Google or Facebook.</li>
            </ul>
          </template>

          <template v-else-if="s.key === 'website'">
            <p>The things that change most, edited without opening the Studio:</p>
            <ul>
              <li><strong>Store hours &amp; closures</strong>: one list that updates every page showing your hours. Use <strong>Add a holiday or closure</strong> for days you're closed, and remove them once they've passed.</li>
              <li><strong>Header message</strong>: the short line beside your logo on every page. If it mentions your hours, update it when they change.</li>
              <li><strong>Sale page</strong>: the heading, details and flyer for your next sale, plus a switch to show it in the website menu while the sale is on.</li>
              <li><strong>Frequently asked questions</strong>: edit, add, reorder or remove questions. Bold text, lists and links work with the buttons above each answer.</li>
              <li><strong>Phone &amp; email</strong>: changed everywhere they appear at once.</li>
            </ul>
            <p>Each section has its own <strong>Save to website</strong> button, and changes show on the website within a minute. <strong>Undo changes</strong> puts a section back the way it was before you started.</p>
            <p class="help__note">
              If a section says it has unpublished changes in the Studio, open the Studio, publish or discard that page's draft, then reload. That stops the two from overwriting each other.
            </p>
          </template>

          <template v-else-if="s.key === 'blog'">
            <p>A shelf of blog post ideas for your store, so you never start from a blank page.</p>
            <ol>
              <li>Open <RouterLink to="/blog-assist">Blog Assist</RouterLink>. Ideas that suit the time of year come first.</li>
              <li>Pick one and click <strong>Start a draft</strong>. A draft post with the idea's title and angle is created in your Studio.</li>
              <li>Follow the link to the draft, write it in your own words, add a photo, and click <strong>Publish</strong> in the Studio when it's ready.</li>
            </ol>
            <p>Have an idea of your own? Click <strong>Add an idea</strong> to put it on the shelf. Leave the months blank for an idea that suits any time of year.</p>
            <p class="help__note">Nothing is published for you. Every draft waits in the Studio until you publish it.</p>
          </template>

          <template v-else-if="s.key === 'content'">
            <p>
              Photos, page text and blog posts are edited in the
              <a v-if="studioUrl" :href="studioUrl" target="_blank" rel="noopener noreferrer">Studio<span class="sr-only"> (opens in a new tab)</span></a><template v-else>Studio</template>.
            </p>
            <ul>
              <li><strong>Changes go live when you click Publish.</strong> There's no separate step: refresh the website and you'll see them.</li>
              <li><strong>To schedule a blog post</strong>, set its publish date in the future. It stays hidden on the website until that date, then appears on its own.</li>
              <li><strong>Lists:</strong> use the Studio's list button rather than typing bullet characters, so lists line up properly.</li>
            </ul>
            <p>Hours, the header message, the sale page, FAQs and your phone and email can also be changed from <RouterLink to="/website">Edit Website</RouterLink>.</p>
            <p>Want something changed that the Studio doesn't cover, like layout, a new page type or a new feature? Send us an Update or Feature Request.</p>
          </template>

          <template v-else-if="s.key === 'billing'">
            <p>Your invoices and payment history.</p>
            <ul>
              <li><strong>Pending</strong>: invoices still to be paid, with the amount and due date. These also appear at the top of the Overview.</li>
              <li><strong>Payment history</strong>: everything that's been paid, by Zelle, check or card.</li>
              <li><strong>Paying:</strong> invoices are normally paid by Zelle, using the details on the invoice email.</li>
            </ul>
            <p class="help__note">
              To change how you pay, or if an invoice looks wrong, send a note through Contact &amp; Support with the invoice number. We'll never ask you to type card details into this dashboard.
            </p>
          </template>

          <template v-else-if="s.key === 'support'">
            <p>The best way to reach us. Choose the kind of request that fits best:</p>
            <ul>
              <li><strong>Bug Report</strong>: something is broken, like a link that goes nowhere, a missing image or a form that won't send.</li>
              <li><strong>Update Request</strong>: change some wording, swap a photo, update your hours.</li>
              <li><strong>Question</strong>: not sure how to do something, or want our take.</li>
              <li><strong>Feature Request</strong>: something new for your site or dashboard.</li>
              <li><strong>Other</strong>: anything else.</li>
            </ul>
            <p class="help__note">For anything urgent, such as the site being down or a payment problem, put "URGENT" in the subject and we'll prioritize it.</p>
          </template>

          <template v-else-if="s.key === 'tutorials'">
            <p>Walk-throughs we've recorded for your site:</p>
            <ul>
              <li v-for="video in config.tutorialVideos" :key="video.url">
                <a :href="video.url" target="_blank" rel="noopener noreferrer">{{ video.title }}<span class="sr-only"> (opens in a new tab)</span></a>
              </li>
            </ul>
          </template>

          <template v-else-if="s.key === 'troubleshooting'">
            <dl class="help__faq">
              <dt>I can't sign in, or the sign-in page keeps coming back.</dt>
              <dd>Use the email address your dashboard was set up for. If the page keeps looping, clear this site's cookies and try again. If it still won't let you in, email us and we'll check your access.</dd>

              <dt>A page shows "Sign-in problem".</dt>
              <dd>Sign out from the bottom of the menu and sign in again. If the message comes back, send us its exact wording; it tells us what to fix.</dd>

              <dt>I published a change but don't see it on the website.</dt>
              <dd>Refresh the page (Cmd/Ctrl + Shift + R). If a blog post is still missing, check its publish date isn't in the future.</dd>

              <dt>Last month's report isn't there yet.</dt>
              <dd>Each report is written on the 3rd of the following month. If it's later than that and still missing, let us know.</dd>

              <dt>Site health says "Needs work".</dt>
              <dd>Google's test is strict, and scores move a few points from one test to the next. We watch these each month and will tell you if something needs doing.</dd>

              <dt>An invoice looks wrong.</dt>
              <dd>Reply to the invoice email or send a note through Contact &amp; Support with the invoice number, and we'll sort it out.</dd>
            </dl>
          </template>
        </div>
      </section>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.help { max-width: 820px; }
.help__intro { margin-bottom: 1.5rem; font-size: 0.9375rem; line-height: 1.6; color: var(--color-text-secondary); }
.help__intro a, .help__body a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; }

.help__section {
  margin-bottom: 0.75rem; overflow: hidden;
  background-color: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: calc(var(--border-radius) * 1.5); box-shadow: var(--shadow-card);
}
.help__heading { margin: 0; font-size: inherit; }
.help__header {
  display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 1rem 1.25rem;
  background: none; border: none; cursor: pointer; text-align: left;
  color: var(--color-text); font-family: var(--font-heading); font-size: 1rem; font-weight: 700;
}
.help__header:hover { background-color: var(--color-bg); }
.help__title { flex: 1; }
.help__chevron { flex-shrink: 0; color: var(--color-text-secondary); }
@media (prefers-reduced-motion: no-preference) {
  .help__chevron { transition: transform 0.15s ease; }
}
.help__chevron--open { transform: rotate(180deg); }

.help__body {
  padding: 1rem 1.25rem 1.25rem; border-top: 1px solid var(--color-border);
  font-size: 0.9375rem; line-height: 1.65; color: var(--color-text);
}
.help__body p { margin: 0.5rem 0; }
.help__body ul, .help__body ol { margin: 0.5rem 0; padding-left: 1.25rem; }
.help__body ul { list-style: disc; }
.help__body ol { list-style: decimal; }
.help__body li { margin: 0.4rem 0; }
.help__note {
  margin-top: 0.75rem; padding: 0.75rem 1rem; font-size: 0.875rem;
  background-color: var(--color-bg); border-left: 3px solid var(--color-secondary);
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
}
.help__faq dt { margin-top: 1rem; font-weight: 700; color: var(--color-text); }
.help__faq dt:first-child { margin-top: 0; }
.help__faq dd { margin: 0.25rem 0 0; color: var(--color-text-secondary); }
</style>
