"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "cn";

type AppChromePrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

const AppChromePrimaryButton = forwardRef<
  HTMLButtonElement,
  AppChromePrimaryButtonProps
>(function AppChromePrimaryButton(
  { className, type = "button", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("app-chrome-primary-btn", className)}
      {...props}
    >
      {children}
    </button>
  );
});

export default AppChromePrimaryButton;
