/* PostHog lives in its own lazily imported chunk, so it never adds to the page's first load */
import("posthog-js").then(({ default: posthog }) => {
  posthog.init(import.meta.env.PUBLIC_POSTHOG_KEY, {
    api_host: import.meta.env.PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
  });
  window.posthog = posthog;
});
