import { Drawer } from 'expo-router/drawer';
import { ProTraderDrawerContent } from '../../components/drawer/ProTraderDrawerContent';
import { colors } from '../../theme/tokens';

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={() => <ProTraderDrawerContent />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: colors.surface,
          width: 300,
        },
        drawerType: 'front',
        overlayColor: 'rgba(0, 0, 0, 0.7)',
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="api-keys"
        options={{
          drawerLabel: 'API Keys',
          title: 'API Keys',
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
        }}
      />
      <Drawer.Screen
        name="security"
        options={{
          drawerLabel: 'Security',
          title: 'Security',
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
        }}
      />
      <Drawer.Screen
        name="trade-history"
        options={{
          drawerLabel: 'Trade History',
          title: 'Trade History',
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
        }}
      />
      <Drawer.Screen
        name="support"
        options={{
          drawerLabel: 'Support',
          title: 'Support',
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
        }}
      />
    </Drawer>
  );
}
