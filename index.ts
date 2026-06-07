import home from "./index.html";
import play from "./src/play/index.html";
import keying from "./src/keying/index.html";
import settings from "./src/settings-page/index.html";
import test from "./src/test/index.html";

const server = Bun.serve({
  routes: {
    "/": home,
    "/play/": play,
    "/keying/": keying,
    "/settings/": settings,
    "/test/": test,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Morse Trainer running at ${server.url}`);
