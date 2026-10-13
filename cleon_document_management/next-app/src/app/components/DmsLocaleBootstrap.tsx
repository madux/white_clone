"use client";

import { useDmsLocale } from "../../../hooks/useDmsLocale";

/** Loads org date format and time zone for shared formatters. */
export default function DmsLocaleBootstrap() {
  useDmsLocale(true);
  return null;
}
