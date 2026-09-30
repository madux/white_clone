import type { SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement>;

function logoProps(props: LogoProps) {
  return {
    viewBox: "0 0 24 24",
    width: 16,
    height: 16,
    "aria-hidden": true as const,
    ...props,
    className: props.className ?? "size-4",
  };
}

export function GoogleDriveLogo(props: LogoProps) {
  return (
    <svg {...logoProps(props)}>
      <path fill="#0F9D58" d="M8.15 13.5 3 21h6.3l5.15-7.5z" />
      <path fill="#FFBA00" d="M15.85 13.5 10.7 21H21z" />
      <path fill="#4285F4" d="M8.15 13.5h7.7L12 6.5z" />
    </svg>
  );
}

export function OneDriveLogo(props: LogoProps) {
  return (
    <svg {...logoProps(props)}>
      <path
        fill="#0078D4"
        d="M9.2 9.1c.9-2 2.9-3.3 5.1-3.3 2.6 0 4.8 1.8 5.4 4.2 2.2.2 3.8 2.1 3.8 4.3 0 2.4-2 4.4-4.4 4.4H6.6C3.5 18.7 1 16.2 1 13.1c0-2.7 1.9-4.9 4.5-5.4.9-1.6 2.6-2.6 4.5-2.6 1.2 0 2.3.3 3.2.9-.5.5-1 1.1-1.3 1.8-.6-.2-1.2-.4-1.9-.4-2 0-3.6 1.6-3.6 3.6 0 .3 0 .5.1.8H6.6c-1.7 0-3.1 1.4-3.1 3.1S4.9 17 6.6 17h12.5c1.5 0 2.7-1.2 2.7-2.7 0-1.4-1.1-2.6-2.5-2.7l-.6-.1-.1-.6c-.3-1.8-1.9-3.1-3.7-3.1-1.5 0-2.9.9-3.4 2.3z"
      />
    </svg>
  );
}

export function SharePointLogo(props: LogoProps) {
  return (
    <svg {...logoProps(props)}>
      <rect x="3" y="3" width="8.2" height="8.2" rx="1.4" fill="#038387" />
      <rect x="12.8" y="3" width="8.2" height="8.2" rx="1.4" fill="#4CB4B7" />
      <rect x="3" y="12.8" width="8.2" height="8.2" rx="1.4" fill="#4CB4B7" />
      <rect x="12.8" y="12.8" width="8.2" height="8.2" rx="1.4" fill="#1A9BA0" />
      <circle cx="12" cy="12" r="3.4" fill="#fff" />
      <path
        fill="#038387"
        d="M11.1 10.3h1.1c.9 0 1.5.5 1.5 1.3 0 .6-.3 1-.8 1.2l1 1.9h-1.2l-.8-1.6h-.7V14.7h-1.1zm1.1 1.8c.4 0 .6-.2.6-.5s-.2-.5-.6-.5h-.1v1z"
      />
    </svg>
  );
}

export function DropboxLogo(props: LogoProps) {
  return (
    <svg {...logoProps(props)}>
      <path
        fill="#0061FF"
        d="m7 3.2 5 3.2-5 3.2-5-3.2zm10 0 5 3.2-5 3.2-5-3.2zM2 12.8l5 3.2 5-3.2-5-3.2zm15 0 5-3.2-5-3.2-5 3.2zM7 17.2l5 3.2 5-3.2-5-3.2z"
      />
    </svg>
  );
}

export const CLOUD_SOURCE_OPTIONS = [
  { provider: "google_drive", label: "Google Drive", icon: GoogleDriveLogo },
  { provider: "onedrive", label: "OneDrive", icon: OneDriveLogo },
  { provider: "sharepoint", label: "SharePoint", icon: SharePointLogo },
  { provider: "dropbox", label: "Dropbox", icon: DropboxLogo },
] as const;
