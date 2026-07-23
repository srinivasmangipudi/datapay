import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OnboardingFlow } from "./src/onboarding/OnboardingFlow";

export default function App() {
  return (
    <SafeAreaProvider>
      <OnboardingFlow />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
