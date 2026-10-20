"use client";

// The producer layout renders no shell (the picker and the event layout do),
// so an error here replaces the whole page: the app-wide screen, with its own <main>.
export { default } from "../error";
