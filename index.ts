import home from "./index.html";
import listen from "./src/listen/index.html";
import keying from "./src/keying/index.html";
import chat from "./src/chat/index.html";
import settings from "./src/settings-page/index.html";
import test from "./src/test/index.html";

const server = Bun.serve({
  routes: {
    "/": home,
    "/listen/": listen,
    "/keying/": keying,
    "/chat/": chat,
    "/settings/": settings,
    "/test/": test,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Morse Trainer running at ${server.url}`);
