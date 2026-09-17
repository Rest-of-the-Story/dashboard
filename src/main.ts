import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createHead } from '@unhead/vue';
import { createAuth0 } from '@auth0/auth0-vue';
import App from './App.vue';
import router from './router';
import './assets/styles/main.css';

const app = createApp(App);
const pinia = createPinia();
const head = createHead();

app.use(pinia);
app.use(router);
app.use(head);
app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin,
    },
    // Survive a refresh (and Safari/Chrome third-party cookie blocking), so
    // fetching the ID token for API calls doesn't bounce the user to login.
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
  })
);

app.mount('#app');
