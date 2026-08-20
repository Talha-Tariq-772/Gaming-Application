"use client";

import { useRef } from "react";
import Button, { type ButtonProps } from "@/components/Button";
import { useMagneticHover } from "@/src/lib/use-magnetic-hover";

/**
 * Opt-in wrapper for the one or two CTAs on the site that actually want
 * the magnetic-hover flourish — Button itself stays a plain, server-safe
 * presentational component. Pulls the underlying DOM node out via
 * Button's forwardRef so useMagneticHover can attach to it directly, no
 * extra wrapping element in the DOM.
 */
export default function MagneticButton(props: ButtonProps) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  useMagneticHover(ref);
  return <Button ref={ref} {...props} />;
}
