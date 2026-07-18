import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/hooks/useTranslation";

export default function NotFoundScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: t.oopsTitle }} />
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
            <Feather name="compass" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t.screenNotFoundTitle}
          </Text>

          <Link href="/" style={[styles.link, { backgroundColor: colors.primary }]}>
            <Text style={[styles.linkText, { color: colors.primaryForeground }]}>
              {t.goToHomeScreen}
            </Text>
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    gap: 14,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  link: {
    marginTop: 10,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  linkText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
