import { StatusBar } from "expo-status-bar";
import { OnboardingFlow } from "./src/onboarding/OnboardingFlow";

export default function App() {
  return (
    <>
      <OnboardingFlow />
      <StatusBar style="auto" />
    </>
  );
}
