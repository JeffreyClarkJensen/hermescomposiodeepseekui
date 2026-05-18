import { View, StyleSheet } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { colors } from '../../lib/theme';
import LogsDrawer from '../../components/LogsDrawer';
import FloatingNav from '../../components/FloatingNav';

const ROUTE_MAP: Record<string, string> = {
  '/':            'index',
  '/index':       'index',
  '/tools':       'tools',
  '/memory':      'memory',
  '/crm':         'crm',
  '/analytics':   'analytics',
};

export default function TabLayout() {
  const router   = useRouter();
  const pathname = usePathname();
  const active   = ROUTE_MAP[pathname] ?? 'index';

  const navigate = (route: string) => {
    router.push(route === 'index' ? '/' : `/${route}` as any);
  };

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => null}
      >
        <Tabs.Screen name="index"     />
        <Tabs.Screen name="tools"     />
        <Tabs.Screen name="memory"    />
        <Tabs.Screen name="crm"       />
        <Tabs.Screen name="analytics" />
      </Tabs>

      <LogsDrawer />
      <FloatingNav activeRoute={active} navigate={navigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
