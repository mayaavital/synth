import { Stack } from "expo-router/stack";

export default function Layout() {
  return (
    <Stack headerShown={false}>
      <Stack.Screen
        name="index"
        options={{
          title: "Synth",
          headerTitleStyle: { color: "white" },
          headerStyle: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingBottom: 20,
            backgroundColor: "#1B1B1B",
            headerShadowVisible: true,
            shadowColor: "#c084fc", // light purple (#c084fc is Tailwind's purple-400)
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
          },
          headerBackVisible: false,
        }}
      ></Stack.Screen>
    </Stack>
  );
}
