import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font } from '../../lib/theme';
import LogsDrawer from '../../components/LogsDrawer';
import VoiceFAB from '../../components/VoiceFAB';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; label: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index',     label: 'Chat',      icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
  { name: 'tools',     label: 'Tools',     icon: 'construct-outline',            iconActive: 'construct' },
  { name: 'memory',    label: 'Memory',    icon: 'library-outline',              iconActive: 'library' },
  { name: 'crm',       label: 'CRM',       icon: 'people-outline',               iconActive: 'people' },
  { name: 'analytics', label: 'Analytics', icon: 'bar-chart-outline',            iconActive: 'bar-chart' },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ state, descriptors, navigation }) => (
          <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {state.routes.map((route, index) => {
              const tab = TABS.find(t => t.name === route.name) ?? TABS[0];
              const focused = state.index === index;
              return (
                <Pressable
                  key={route.key}
                  onPress={() => navigation.navigate(route.name)}
                  style={styles.tabItem}
                >
                  <Ionicons
                    name={focused ? tab.iconActive : tab.icon}
                    size={22}
                    color={focused ? colors.accent : colors.inkFaint}
                  />
                  <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      >
        {TABS.map(tab => (
          <Tabs.Screen key={tab.name} name={tab.name} />
        ))}
      </Tabs>

      {/* Global overlays */}
      <LogsDrawer />
      <VoiceFAB />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    color: colors.inkFaint,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: '700',
  },
});
