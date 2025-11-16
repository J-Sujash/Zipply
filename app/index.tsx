import { Redirect } from "expo-router";
import React from "react";

export default function Index() {
  // Always redirect to tabs; the tabs layout will handle auth checks
  return <Redirect href="/(tabs)/home" />;
}
