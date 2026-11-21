// Web (used for previews and automated tests): the browser's localStorage.
export const sessionStorage = typeof window === "undefined" ? undefined : window.localStorage;
