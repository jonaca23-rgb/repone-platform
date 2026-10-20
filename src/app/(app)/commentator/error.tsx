"use client";

// The commentator layout renders no shell (the picker, the event layout and
// the floor page do), so an error here replaces the whole page: the app-wide
// screen, with its own <main>.
export { default } from "../error";
