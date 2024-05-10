(function () {
  console.log("start");
  const JOGAGGEUL_SESSION_KEY = "jogaggeul-session";
  const script = document.currentScript as HTMLScriptElement;
  const jogaggeulOrigin = new URL(script.src).origin;

  function formatError(message: string) {
    return `[giscus] An error occurred. Error message: "${message}".`;
  }

  function getMetaContent(property: string, og = false) {
    const ogSelector = og ? `meta[property='og:${property}'],` : "";
    const element = document.querySelector<HTMLMetaElement>(
      ogSelector + `meta[name='${property}']`
    );

    return element ? element.content : "";
  }

  // Set up session and clear the session param on load
  const url = new URL(location.href);
  let session = url.searchParams.get("jogaggeul") || "";
  const savedSession = localStorage.getItem(JOGAGGEUL_SESSION_KEY);
  url.searchParams.delete("jogaggeul");
  url.hash = "";
  const cleanedLocation = url.toString();

  if (session) {
    localStorage.setItem(JOGAGGEUL_SESSION_KEY, JSON.stringify(session));
    history.replaceState(undefined, document.title, cleanedLocation);
  } else if (savedSession) {
    try {
      session = JSON.parse(savedSession);
    } catch (e) {
      localStorage.removeItem(JOGAGGEUL_SESSION_KEY);
      // console.warn(`${formatError(e?.message)} Session has been cleared.`);
    }
  }

  const attributes = script.dataset;
  const params: Record<string, string> = {};

  params.origin = cleanedLocation;
  params.session = session as string;
  // params.theme = attributes.theme as string;
  // params.reactionsEnabled = attributes.reactionsEnabled || "1";
  // params.emitMetadata = attributes.emitMetadata || "0";
  // params.inputPosition = attributes.inputPosition || "bottom";
  params.repo = attributes.repo as string;
  params.repoId = attributes.repoId as string;
  params.category = attributes.category || "";
  params.categoryId = attributes.categoryId as string;
  params.strict = attributes.strict || "0";
  // params.description = getMetaContent("description", true);
  // params.backLink = getMetaContent("giscus:backlink") || cleanedLocation;

  switch (attributes.mapping) {
    case "url":
      params.term = cleanedLocation;
      break;
    case "title":
      params.term = document.title;
      break;
    case "og:title":
      params.term = getMetaContent("title", true);
      break;
    case "specific":
      params.term = attributes.term as string;
      break;
    case "number":
      params.number = attributes.term as string;
      break;
    case "pathname":
    default:
      params.term =
        location.pathname.length < 2
          ? "index"
          : location.pathname.substring(1).replace(/\.\w+$/, "");
      break;
  }

  // Check anchor of the existing container and append it to origin URL
  const existingContainer = document.querySelector(".jogaggeul");
  const id = existingContainer && existingContainer.id;
  if (id) {
    params.origin = `${cleanedLocation}#${id}`;
  }

  // Link default style and prepend as <head>'s first child to make override possible.
  const style =
    (document.getElementById("giscus-css") as HTMLLinkElement) ||
    document.createElement("link");
  style.id = "giscus-css";
  style.rel = "stylesheet";
  style.href = `${jogaggeulOrigin}/default.css`;
  document.head.prepend(style);

  // Set up iframe src and loading attribute
  const locale = attributes.lang ? `/${attributes.lang}` : "";
  const src = `${jogaggeulOrigin}${locale}/widget?${new URLSearchParams(
    params
  )}`;
  const loading = attributes.loading === "lazy" ? "lazy" : undefined;

  // Set up iframe element
  const iframeElement = document.createElement("iframe");
  const iframeAttributes = {
    class: "giscus-frame giscus-frame--loading",
    title: "Comments",
    scrolling: "no",
    allow: "clipboard-write",
    src,
    loading,
  };
  Object.entries(iframeAttributes).forEach(
    ([key, value]) => value && iframeElement.setAttribute(key, value)
  );

  // Prevent white flash on load
  iframeElement.style.opacity = "0";
  iframeElement.addEventListener("load", () => {
    iframeElement.style.removeProperty("opacity");
    iframeElement.classList.remove("giscus-frame--loading");
  });

  // Insert iframe element
  if (!existingContainer) {
    const iframeContainer = document.createElement("div");
    iframeContainer.setAttribute("class", "jogaggeul");
    iframeContainer.appendChild(iframeElement);

    script.insertAdjacentElement("afterend", iframeContainer);
  } else {
    while (existingContainer.firstChild) existingContainer.firstChild.remove();
    existingContainer.appendChild(iframeElement);
  }
  const suggestion = `Please consider reporting this error at https://github.com/giscus/giscus/issues/new.`;

  function signOut() {
    delete params.session;
    const src = `${jogaggeulOrigin}/widget?${new URLSearchParams(params)}`;
    iframeElement.src = src; // Force reload
  }

  // Listen to messages
  window.addEventListener("message", (event) => {
    if (event.origin !== jogaggeulOrigin) return;

    const { data } = event;
    if (!(typeof data === "object" && data.giscus)) return;

    if (data.giscus.resizeHeight) {
      iframeElement.style.height = `${data.giscus.resizeHeight}px`;
    }

    if (data.giscus.signOut) {
      localStorage.removeItem(JOGAGGEUL_SESSION_KEY);
      console.log(`[giscus] User has logged out. Session has been cleared.`);
      signOut();
      return;
    }

    if (!data.giscus.error) return;

    const message: string = data.giscus.error;

    if (
      message.includes("Bad credentials") ||
      message.includes("Invalid state value") ||
      message.includes("State has expired")
    ) {
      // Might be because token is expired or other causes
      if (localStorage.getItem(JOGAGGEUL_SESSION_KEY) !== null) {
        localStorage.removeItem(JOGAGGEUL_SESSION_KEY);
        console.warn(`${formatError(message)} Session has been cleared.`);
        signOut();
      } else if (!savedSession) {
        console.error(
          `${formatError(
            message
          )} No session is stored initially. ${suggestion}`
        );
      }
    } else if (message.includes("Discussion not found")) {
      console.warn(
        `[giscus] ${message}. A new discussion will be created if a comment/reaction is submitted.`
      );
    } else if (message.includes("API rate limit exceeded")) {
      console.warn(formatError(message));
    } else {
      console.error(`${formatError(message)} ${suggestion}`);
    }
  });
})();
