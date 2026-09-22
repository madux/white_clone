"use client";

import ModuleOnboardingGuide from "./ModuleOnboardingGuide";

/** Workspace guide (personal documents). Other modules mount their own guide on their pages. */
export default function OnboardingGuide() {
  return <ModuleOnboardingGuide module="workspace" />;
}
